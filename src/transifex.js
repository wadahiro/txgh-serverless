'use strict';

const crypto = require('crypto');
const md5 = require('md5');
const Transifex = require("transifex");
const GitHub = require('github-api');

// Envrionment Vars
const GH_REPO = process.env.GH_REPO;
const GH_BASE_BRANCH = process.env.GH_BASE_BRANCH;
const GH_COMMITER_USERNAME = process.env.GH_COMMITER_USERNAME;
const GH_COMMITER_EMAIL = process.env.GH_COMMITER_EMAIL;
const GH_COMMITER_TOKEN = process.env.GH_COMMITER_TOKEN;
const TX_ORG = process.env.TX_ORG;
const TX_PROJECT = process.env.TX_PROJECT;
const TX_SECRET = process.env.TX_SECRET;
const TX_CREDENTIAL = process.env.TX_CREDENTIAL;
const SITE_URL = process.env.SITE_URL;

// initizalize
const transifex = new Transifex({
    project_slug: TX_PROJECT,
    credential: TX_CREDENTIAL
});
const gh = new GitHub({
   username: GH_COMMITER_USERNAME,
   token: GH_COMMITER_TOKEN
});


module.exports.transifex = (event, context, callback) => {
  if (!validate(event, TX_SECRET)) {
    callback(null, {statusCode: 400});
    return;
  };

  const body = JSON.parse(event.body);

  const txProject = body.project;
  const txResource = body.resource;
  const txLanguage = body.language;
  // translation_completed: all messages are traslated (not reviewed yet)
  // review_completed: all messages are traslated and reviewed
  // fillup_completed: ???
  const txEvent = body.event;

  console.log(`[INFO] Handling ${body}`);
  
  handleHook(txProject, txResource, txLanguage, txEvent)
    .then(() => {
      console.log('[INFO] Handling transifex webhook successful.');
      callback(null, {statusCode: 200});

    }).catch(err => {
      console.log('[ERROR] Handling transifex webhook failed.', err);
      callback(null, {statusCode: 500});
    });
};


function validate(event, secret) {
  const sig = event.headers['X-TX-Signature-V2'];
  const url = event.headers['X-TX-Url'];
  const date = event.headers['Date'];
  const data = event.body;

  console.log(`[INFO] Validating ${sig}, ${url}, ${date}, ${data}`);

  const content_md5 = md5(data);
  const msg = ['POST', url, date, content_md5].join('\n');
  const hmac = crypto.createHmac('sha256', secret);
  const sig2 = hmac.update(msg).digest().toString('base64');

  console.log(`[INFO] Signature: ${sig2}`);

  return sig === sig2;
};

function handleHook(txProject, txResource, txLanguage, txEvent) {
  return Promise.all([
    fetchTxConfig(GH_REPO),
    fetchTranslation(txProject, txResource, txLanguage, null)
  ]).then(results => {
    const [txConfig, { translator, content }] = results;

    const path = txConfig[`${txProject}.${txResource}`];
    if (!path) {
      throw new Error(`Not found config in .tx/config for [${txProject}.${txResource}]`);
    }
    const txHost = txConfig['main'];

    const translatedPath = path.replace(/<lang>/g, txLanguage);
    const commiter = {name: GH_COMMITER_USERNAME, email: GH_COMMITER_EMAIL};

    return ghCommit(txHost, TX_ORG, txProject, txResource, txLanguage, txEvent,
      GH_REPO, GH_BASE_BRANCH, translatedPath, content, translator || commiter, commiter, SITE_URL)
  });
}


// Util Functions

function getGHRepo(fullRepo) {
  const [owner, repo] = fullRepo.split('/');
  return gh.getRepo(owner, repo);
}

function fetchTxConfig(fullRepo) {
  const ghRepo = getGHRepo(fullRepo);

  return ghRepo.getContents('develop', '.tx/config', true)
    .then(data => {
      return data.data;
    }).then(txConfig => {
      return txConfig.split('\n').reduce((s, x, l) => {
        if (x.startsWith('[') && x.endsWith(']')) {
          const key = x.slice(1, -1); 
          s.key = key;

          if (!s.result[key]) {
            s.result[key] = null;
          }
        }

        // Handling [main] section
        if (x.startsWith('host') && s.key === 'main') {
          if (s.key === null) {
            throw new Error(`Not found 'host' config under [main] section at .tx/config:${l}`);
          }
          s.result['main'] = x.split('=')[1].trim();
        }

        // Handling [<project_slug>.<resource_slug>] section
        if (x.startsWith('file_filter')) {
          if (s.key === null) {
            throw new Error(`Not found 'file_filter' config under [<project_slug>.<resource_slug>] at .tx/config:${l}`);
          }
          const path = x.split('=')[1]
          if (path) {
            s.result[s.key] = path.trim();
          }
        }

        return s;
      }, {key: null, result:{} }).result;
    });
}

function fetchTranslation(project_slug, resource_slug, lang) {
  return new Promise((resolve, reject) => {
    transifex.translationInstanceMethod(project_slug, resource_slug, lang, null, (err, data) => {
      if (err) {
        reject(err);
        return;
      }

      // TODO Handle translator other than po files 
      const lastTranslator = data.match(/^"Last\-Translator: (.*),.*$/m);

      let translator = null;
      if (lastTranslator) {
        const m = lastTranslator[1].trim().match(/(.*) <(.*)>/);
        translator = {
          name: m[1],
          email: m[2]
        };
      }

      resolve({
        translator,
        content: data
      });
    });
  });
}

function fetchTranslationMetadata(project_slug, resource_slug, lang) {
  return transifex.translationStringsMethod(project_slug, resource_slug, lang, null, (err, data) => {
    console.log(data)
    return data
  });
}

function ghCommit(txHost, txOrg, txProject, txResource, txLang, txEvent,
    fullRepo, baseBranch, path, content, author, commiter, siteUrl) {
  const ghOwner = fullRepo.split('/')[0];
  const branch = `translate-${txResource}`;

  const commitMessage = `[${txEvent}] Updating translations for ${path}

Translate-URL: ${txHost}/${txOrg}/${txProject}/translate/#${txLang}/${txResource}`;

  const prMessage = `* Path: \`${path}\`
* Language: \`${txLang}\`
* Translate-URL: ${txHost}/${txOrg}/${txProject}/translate/#${txLang}/${txResource}
* Translated-Site-URL: ${siteUrl.replace(/<branch>/g, branch).replace(/<lang>/g, txLang)}
`

  const ghRepo = getGHRepo(fullRepo);

  return ghRepo.getBranch(branch)
    .catch(err => {
      if (err.response && err.response.status === 404) {
        console.log(`[INFO] Not found '${branch}' branch, creating...`);
        return ghRepo.createBranch(baseBranch, branch);
      }
    }).then(() => {
      return ghRepo.writeFile(branch, path, content,
        commitMessage, {author, commiter});
    }).then(() => {
      return ghRepo.listPullRequests({
        state: 'open',
        head: `${ghOwner}:${branch}`,
        base: baseBranch
      }).then(list => {
        console.log('[INFO] listPullRequests', list);

        if (list.data.length === 0) {
          return ghRepo.createPullRequest({
            title: `Translations for ${path}`,
            head: `${ghOwner}:${branch}`,
            base: baseBranch,
            body: prMessage
          });
        }
      });
    });
}

