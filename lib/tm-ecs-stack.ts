import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { TmApplicationLoadBalancedFargateService, TmApplicationLoadBalancedFargateServiceProps } from 'tm-cdk-constructs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { AwsManagedPrefixList } from './cloudfront/prefixList';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as ecr_assets from 'aws-cdk-lib/aws-ecr-assets';

interface CustomTmApplicationLoadBalancedFargateServiceProps extends TmApplicationLoadBalancedFargateServiceProps {
  secondBuildContextPath?: string; // New optional properties for additional image build path
  secondBuildDockerfile?: string;
}

class CustomTmApplicationLoadBalancedFargateService extends TmApplicationLoadBalancedFargateService {
  constructor(scope: Construct, id: string, props: CustomTmApplicationLoadBalancedFargateServiceProps) {
    // Create the primary Docker image asset
    // const primaryDockerImageAsset = new DockerImageAsset(scope, 'PrimaryApplicationImage', {
    //   directory: props.buildContextPath!,
    //   file: props.buildDockerfile!,
    //   followSymlinks: cdk.SymlinkFollowMode.ALWAYS,
    // });

    // Optionally create a secondary Docker image asset
    const secondaryDockerImageAsset = props.secondBuildContextPath && props.secondBuildDockerfile
      ? new ecr_assets.DockerImageAsset(scope, 'SecondaryApplicationImage', {
          directory: props.secondBuildContextPath,
          file: props.secondBuildDockerfile,
          followSymlinks: cdk.SymlinkFollowMode.ALWAYS,
        })
      : undefined;

    // Initialize the original class with custom props
    super(scope, id, props);

    // Add secondary container if the image was created
    if (secondaryDockerImageAsset) {
      const secondaryContainer = this.taskDefinition.addContainer('SecondaryContainer', {
        image: ecs.ContainerImage.fromDockerImageAsset(secondaryDockerImageAsset),
        logging: ecs.LogDriver.awsLogs({ streamPrefix: 'secondaryImage' }),
      });
      secondaryContainer.addPortMappings({
        containerPort: 8080, // Port that NGINX listens on
        protocol: ecs.Protocol.TCP,
      });
    }

  }
}

export interface TmEcsStackProps extends cdk.StackProps {
  readonly vpc: ec2.IVpc;
  readonly allowPublicInternetAccess?: boolean;
  readonly listenToHttp?: boolean;
  readonly listenToHttps?: boolean;
  readonly memoryLimitMiB?: number;
  readonly cpu?: number;
  readonly desiredCount?: number;
  readonly containerPort?: number;
  readonly minTaskCount?: number;
  readonly maxTaskCount?: number;
  readonly customHttpHeaderParameterName: string;
  readonly secretsFromSsmParameterStore?: string[];
  readonly additionalSecretsFromParameterStore?: { [key: string]: string };
  readonly applicationName: string;
  readonly buildContextPath: string;
  readonly buildDockerfile: string;
  readonly secondBuildContextPath: string;
  readonly secondBuildDockerfile: string;
  readonly scheduledTaskScheduleExpression?: cdk.aws_events.Schedule;
  readonly scheduledTasksCommand?: string;
  readonly rdsClusterSecurityGroup: ec2.ISecurityGroup;
  // readonly redisClusterSecurityGroup: ec2.ISecurityGroup;
  // readonly solrSecurityGroup: ec2.ISecurityGroup;
}

export class TmEcsStack extends cdk.Stack {

  public readonly loadbalancer: elbv2.ILoadBalancerV2;
  public readonly cluster: ecs.ICluster;
  public readonly fargateService: ecs.FargateService;

  constructor(scope: Construct, id: string, props: TmEcsStackProps) {

    super(scope, id, props);

    // Get cloudFront prefixlist
    const cloudFrontPrefixListId = new AwsManagedPrefixList(this, 'CloudfrontOriginPrefixList', {
      name: 'com.amazonaws.global.cloudfront.origin-facing',
    }).prefixListId;

    // // Create a custom Security Group
    const lbSecurityGroup = new ec2.SecurityGroup(this, 'ALBSecurityGroup', {
      vpc: props.vpc,
      allowAllOutbound: true,
      description: 'ALB Security Group',
    });

    //lbSecurityGroup.addIngressRule(ec2.Peer.prefixList(cloudFrontPrefixListId), ec2.Port.tcp(443), 'Allow HTTPS from CloudFront');
    lbSecurityGroup.addIngressRule(ec2.Peer.prefixList(cloudFrontPrefixListId), ec2.Port.tcp(80), 'Allow HTTPS from CloudFront');

    // const customHttpHeaderValue = ssm.StringParameter.valueForStringParameter(
    //   this, 'customHttpHeaderValue');
    // const domainName = ssm.StringParameter.valueForStringParameter(
    //   this, 'domainName');
    // const hostedZoneId = ssm.StringParameter.valueForStringParameter(
    //   this, 'hostedZoneId');

    // Image config
    const secretsFromSsmParameterStore: string[] = props.secretsFromSsmParameterStore || [];
    const additionalSecretsFromSsmParameterStore: { [key: string]: string } = props.additionalSecretsFromParameterStore || {};
    const environment_secrets: { [key: string]: ecs.Secret } = {};

    this.addEnvironmentSecrets(secretsFromSsmParameterStore, environment_secrets, props.applicationName);
    this.addAdditionalEnvironmentSecrets(additionalSecretsFromSsmParameterStore, environment_secrets);

    // /** Service Props*/
    // const patternsProps: TmApplicationLoadBalancedFargateServiceProps = {
    //   vpc: props.vpc,
    //   memoryLimitMiB: props.memoryLimitMiB,
    //   cpu: props.cpu,
    //   desiredCount: props.desiredCount,
    //   minTaskCount: props.minTaskCount,
    //   maxTaskCount: props.maxTaskCount,
    //   containerPort: props.containerPort,
    //   //customHttpHeaderValue: props.customHttpHeaderValue,
    //   customHttpHeaderValue: customHttpHeaderValue,
    //   buildContextPath: props.buildContextPath ?? './',
    //   buildDockerfile: props.buildDockerfile ?? 'Dockerfile',
    //   certificate: new acm.Certificate(this, 'Certificate', {
    //     domainName: domainName,
    //     validation: acm.CertificateValidation.fromDns(HostedZone.fromHostedZoneId(this, 'HostedZone', hostedZoneId)),
    //   }),
    // }

    /** Service Props*/
    const patternsProps: CustomTmApplicationLoadBalancedFargateServiceProps = {
      vpc: props.vpc,
      memoryLimitMiB: props.memoryLimitMiB,
      cpu: props.cpu,
      desiredCount: props.desiredCount,
      minTaskCount: props.minTaskCount,
      maxTaskCount: props.maxTaskCount,
      containerPort: props.containerPort,
      // Force HTTP instead of HTTPS
      listenerPort: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetProtocol: elbv2.ApplicationProtocol.HTTP,
      customHttpHeaderValue: ssm.StringParameter.valueForStringParameter(this, props.customHttpHeaderParameterName),
      secrets: environment_secrets,
      buildContextPath: props.buildContextPath,
      buildDockerfile: props.buildDockerfile,
      secondBuildContextPath: props.secondBuildContextPath,
      secondBuildDockerfile: props.secondBuildDockerfile,
      scheduledTaskScheduleExpression: props.scheduledTaskScheduleExpression,
      //schedule: cdk.aws_events.Schedule.rate(cdk.Duration.minutes(1)),
      scheduledTasksCommand: props.scheduledTasksCommand,
      efsVolumes:  [
        { name: 'assets', path: '/var/www/public/typo3temp/assets' },
      ],
    }

    /** Service Pattern */
    const tmPatterns = new CustomTmApplicationLoadBalancedFargateService(this, 'servicePattern', patternsProps);
    tmPatterns.loadBalancer.addSecurityGroup(lbSecurityGroup);

    tmPatterns.taskDefinition.addToExecutionRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      resources: ["*"],
    }));

    props.rdsClusterSecurityGroup.addIngressRule(
      tmPatterns.service.connections.securityGroups[0],
      ec2.Port.tcp(3306),
      'Allow from Fargate Service',
      true,
    );
    // props.redisClusterSecurityGroup.addIngressRule(
    //   tmPatterns.service.connections.securityGroups[0],
    //   ec2.Port.tcp(6379),
    //   'Allow from Fargate Service',
    //   true,
    // );
    // props.solrSecurityGroup.addIngressRule(
    //   tmPatterns.service.connections.securityGroups[0],
    //   ec2.Port.tcp(8983),
    //   'Allow from Fargate Service',
    //   true,
    // );

    this.loadbalancer = tmPatterns.loadBalancer;
    this.cluster = tmPatterns.cluster;
    this.fargateService = tmPatterns.service;
  }


  private addEnvironmentSecrets(secrets: string[], environmentSecrets: { [key: string]: ecs.Secret }, applicationName: string) {
    for (const secret of secrets) {
      const secretParameter = ssm.StringParameter.fromSecureStringParameterAttributes(this, `${secret}SSMParameter`, {
        parameterName: `/applications/${applicationName}/secrets/${secret}`,
      });
      environmentSecrets[secret] = ecs.Secret.fromSsmParameter(secretParameter);
    }
  }

  private addAdditionalEnvironmentSecrets(secrets: { [key: string]: string }, environmentSecrets: { [key: string]: ecs.Secret }) {
    Object.entries(secrets).forEach(([key, value]) => {
      const secretParameter = ssm.StringParameter.fromSecureStringParameterAttributes(this, `${key}SSMParameter`, {
        parameterName: `${value}`
      });
      environmentSecrets[`${key}`] = ecs.Secret.fromSsmParameter(secretParameter);
    })
  }
}