import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as pipelines from 'aws-cdk-lib/pipelines';
import * as iam from 'aws-cdk-lib/aws-iam';
import { TmPipelineAppStage } from './tm-app-stage';
import * as codecommit from 'aws-cdk-lib/aws-codecommit';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { ApplyRemovalPolicyAspect, getRemovalPolicy } from './utils/removal-policy-aspect';

interface TmPipelineStackProps extends cdk.StackProps {
  readonly repoOwner: string;
  readonly infraRepoName: string;
  readonly appRepoName: string;
  readonly infraBranchName: string;
  readonly appBranchName: string;
  
}
export class TmPipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: TmPipelineStackProps) {
    super(scope, id, props);

  // const removalPolicyString = this.node.tryGetContext('removalPolicy') || 'RETAIN';
  // const removalPolicy = getRemovalPolicy(removalPolicyString);
  const removalPolicy = getRemovalPolicy('DESTROY');

  cdk.Aspects.of(this).add(new ApplyRemovalPolicyAspect(removalPolicy));

  const pipeline = new pipelines.CodePipeline(this, 'TmPipelineStack', {
    crossAccountKeys: true,
    pipelineName: 'TmPipelineStack',
    synth: new pipelines.CodeBuildStep('Synth', {
      input: pipelines.CodePipelineSource.connection(`${props.repoOwner }/${props.infraRepoName}`, props.infraBranchName, {
        connectionArn: 'arn:aws:codeconnections:ca-central-1:445654923997:connection/57f0b3f9-7d4f-420f-952d-7cf1846d045a',
      }),
      /* Additional input from another repository; 
      the ./build directory is where the additional repository
      will be stored during the pipeline process.
      */
      additionalInputs: {
        'build': pipelines.CodePipelineSource.connection(`${props.repoOwner}/${props.appRepoName}`, props.appBranchName, {
          connectionArn: 'arn:aws:codeconnections:ca-central-1:445654923997:connection/57f0b3f9-7d4f-420f-952d-7cf1846d045a',
        }),
      },
      // Commands to run in the synth step
      installCommands: ['npm install', 'npm ci', 'npm install -g aws-cdk'],
      commands: [
        'ls -al',
        //'cd infra',
        'npm install',
        'cdk synth',
        'find . -iname cdk.out',
        'ls -al',
        'pwd',
        //'export VERSION=bookworm'
        //'rm -rf cdk.out/asset.*',
      ],
      primaryOutputDirectory: './cdk.out',
      rolePolicyStatements: [
        new iam.PolicyStatement({
          actions: [
            'ec2:DescribeAvailabilityZones',
            'ssm:GetParameter',
          ],
          resources: ['*'],
        }),
      ],
      env: {
        VERSION: 'bookworm',
      // //   ANOTHER_VARIABLE: process.env.ANOTHER_VARIABLE || 'default-value',
      },

    }),
  });

  pipeline.addStage(new TmPipelineAppStage(this, 'AppStage', {
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: 'ca-central-1'
    }
  }));

}
}