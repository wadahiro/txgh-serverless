# Transifex Txgh-Serverless

## Description
A serverless application that integrates [Transifex](https://www.transifex.com) with Github like [Transifex Txgh](https://github.com/transifex/txgh).

## Features
###  Webhook for transifex integrates Github
* When a resource of Transifex is all translated, 
  1. Create feature branch for translation per the Transifex resource.
  2. Create git commit for the translation from Transifex translation contents. In addition, the user email of the translator in Transifex is used for git commit author (for PO files only currently).
  3. Create pull request from the feature branch to specified target branch.

* When the resource of Transifex is all reviewed,
  1. Add git commit the reviewed translation to the feature branch.


## How to deploy

1. **Install modules via npm:**
    ```
    npm install
    ```

2. **Set-up your aws account:**
    ```
    export AWS_ACCESS_KEY_ID=...
    export AWS_SECRET_ACCESS_KEY=...
    ```

3. **Set-up txgh-serverless config via environment variables:**
    ```
    export SLS_GH_REPO="your-name/your-repository-name";
    export SLS_GH_BASE_BRANCH="develop";
    export SLS_GH_COMMITER_USERNAME="translator";
    export SLS_GH_COMMITER_EMAIL="translator@example.org";
    export SLS_GH_COMMITER_TOKEN="...";
    export SLS_TX_ORG="your-transifex-org-name";
    export SLS_TX_PROJECT="your-transifex-project";
    export SLS_TX_SECRET="your-secret-of-transifex-webhook";
    export SLS_TX_CREDENTIAL="api:your-transifex-api-token"
    export SLS_SITE_URL="http://your-document-site.org/<branch>/<lang>/index.html"
    ```

4. **Deploy!**
    ```
    $ ./node_modules/.bin/serverless deploy --stage production

    Serverless: Packaging service...
    Serverless: Excluding development dependencies...
    Serverless: Uploading CloudFormation file to S3...
    Serverless: Uploading artifacts...
    Serverless: Uploading service .zip file to S3 (3.83 MB)...
    Serverless: Validating template...
    Serverless: Updating Stack...
    Serverless: Checking Stack update progress...
    ....................
    Serverless: Stack update finished...
    Service Information
    service: txgh-serverless
    stage: production
    region: us-east-1
    stack: txgh-serverless-production
    api keys:
    None
    endpoints:
    POST - https://**********.execute-api.us-east-1.amazonaws.com/production/transifex
    POST - https://**********.execute-api.us-east-1.amazonaws.com/production/github
    functions:
    transifex: txgh-serverless-production-transifex
    github: txgh-serverless-production-github
    ```

    You can use above endpoint URL as webhook for transifex.


## License

* [Apache License, Version 2.0](https://www.apache.org/licenses/LICENSE-2.0)


