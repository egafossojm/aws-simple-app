#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { TmPipelineStack } from '../lib/tm-pipeline-stack';
import { AwsSolutionsChecks, NagSuppressions } from 'cdk-nag';
import { Aspects } from 'aws-cdk-lib';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'ca-central-1',
}

const pipelineStack = new TmPipelineStack(app, 'TmPipelineStack', {
  env: env,
  repoOwner : 'egafossojm',
  infraRepoName : 'aws-simple-app',
  appRepoName  : 'aws-simple-app-code',
  infraBranchName : 'main',
  appBranchName : 'main'
});

Aspects.of(app).add(new AwsSolutionsChecks({verbose: true}));

NagSuppressions.addStackSuppressions(pipelineStack, [
  { id: 'AwsSolutions-S1', reason: 'The S3 Bucket has server access logs disabled.' },
  { id: 'AwsSolutions-IAM5', reason: 'The IAM entity contains wildcard permissions and does not have a cdk-nag rule suppression with evidence for those permission.' },
  { id: 'AwsSolutions-CB4', reason: 'The CodeBuild project does not use an AWS KMS key for encryption.' },
  { id: 'AwsSolutions-KMS5', reason: 'The KMS Symmetric key does not have automatic key rotation enabled.' },
]);

app.synth();