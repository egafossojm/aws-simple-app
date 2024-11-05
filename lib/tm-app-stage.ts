import * as cdk from 'aws-cdk-lib';
import { Construct } from "constructs";
import { TmVpcBaseStack } from './tm-vpc-base-stack';
import { TmBastionStack } from './tm-bastion-stack';
import { TmSolrEc2Stack } from './tm-solr-ec2-stack';
import { TmEcsStack, TmEcsStackProps } from './tm-ecs-stack';
import { TmRdsAuroraMysqlServerlessStack } from './tm-rds-aurora-mysql-serverless-stack';
//import { TmCloudfrontStack, TmCloudfrontStackProps } from './tm-cloudfront-stack';
import { TmRedisStack } from './tm-redis-stack';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { NagSuppressions, AwsSolutionsChecks } from 'cdk-nag';
import * as path from 'path';
import { TmCloudfrontStack, TmCloudfrontStackProps } from './tm-cloudfront-stack';

export class TmPipelineAppStage extends cdk.Stage {

  constructor(scope: Construct, id: string, props?: cdk.StageProps) {
    super(scope, id, props);

    function toPascalCase(input: string): string {
      return input
        .split(/[\s_\-]+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');
    }

    const region = 'ca-central-1';
    const regionName = toPascalCase(region);

    const env = {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: region,
    };

    const vpc = new TmVpcBaseStack(this, `TmVpc${regionName}Stack`, {
      env: env,
      range: '10.3.0.0/16',
      //hostedZoneName: 'avatar-site-web.internal',
    });

    const bastion = new TmBastionStack(this, `TmBastion${regionName}Stack`, {
      vpc: vpc.vpc,
      env: env,
      crossRegionReferences: true,
    });

    // const solr = new TmSolrEc2Stack(this, `TmSolrEc2${regionName}Stack`, {
    //   vpc: vpc.vpc,
    //   hostedZone: vpc.hostedZone,
    //   env: env,
    //   crossRegionReferences: true,
    // });

    const rds = new TmRdsAuroraMysqlServerlessStack(this, `TmRdsAurora${regionName}`, {
      env: env,
      vpc: vpc.vpc,
      bastionHost: bastion.securityGroup,
    });

    // const redis = new TmRedisStack(this, `TmRedis${regionName}Stack`, {
    //   env: env,
    //   vpc: vpc.vpc,
    //   crossRegionReferences: true,
    //   allowFromConstructs: { bastion: bastion.securityGroup },
    // }); 

    const ecsStackProps: TmEcsStackProps = {
      env: env,
      vpc: vpc.vpc,
      listenToHttp: true,
      containerPort: 8080,
      crossRegionReferences: true,
      buildContextPath: path.join(__dirname, '../build/'),
      buildDockerfile: 'Dockerfile',
      applicationName: 'avatar',
      rdsClusterSecurityGroup: rds.securityGroup,
      // redisClusterSecurityGroup: redis.securityGroup,
      // solrSecurityGroup: solr.securityGroup,
      cpu: 512,
      memoryLimitMiB: 1024,
      desiredCount: 1,
      hostedZoneIdParameterName: '/avatar/cloudfrontStack/parameters/hostedZoneId',
      customHttpHeaderParameterName: '/avatar/cloudfrontStack/parameters/customHttpHeader',
      domainNameParameterName: '/avatar/cloudfrontStack/parameters/domanName',
      /*
      hostedZoneIdParameterName: 'hostedZoneId',
      customHttpHeaderParameterName: 'customHttpHeaderValue',
      domainParameterName: 'domainName',
      subjectAlternativeNamesParameterName: 'subjectAlternativeNames',
      */
      // for secrets like `/applications/${applicationName}/secrets/${secret}`,
      secretsFromSsmParameterStore: [
        // "WP_DATABASE_HOST",
        // "WP_DATABASE_NAME",
        // "WP_DATABASE_USER_NAME",
        // "WP_DATABASE_USER_PASSWORD",
        //   "TOU_BASE_DOMAIN",
        //   "TOU_DOMAINS_LIST",
        //   "TOU_DATABASE_NAME",
        //   "TOU_DATABASE_PASSWORD",
        //   "TOU_DATABASE_USERNAME",
        //   "TOU_MAIL_DEFAULT_MAIL_FROM_ADDRESS",
        //   "TOU_MAIL_DEFAULT_MAIL_FROM_NAME",
        //   "TOU_MAIL_TRANSPORT",
        //   "TOU_MAIL_TRANSPORT_SENDMAIL_COMMAND",
        //   "TOU_MAIL_TRANSPORT_SMTP_ENCRYPT",
        //   "TOU_MAIL_TRANSPORT_SMTP_PASSWORD",
        //   "TOU_MAIL_TRANSPORT_SMTP_SERVER",
        //   "TOU_MAIL_TRANSPORT_SMTP_USERNAME",
        //   "TOU_ENABLE_REDIS_CACHE_CONFIGURATION",
        //   "TYPO3_CONTEXT",
        //   "TOU_TYPO3_CONF_VARS_SYS_DISPLAY_ERRORS",
        //   "TOU_TYPO3_CONV_VARS_SYS_ENCRYPTION_KEY",
        //   "TOU_TM_S3ASSETS_ACCESS_KEY_ID",
        //   "TOU_TM_S3ASSETS_SECRET_KEY",
        //   "TOU_TM_S3ASSETS_REGION",
        //   "TOU_TM_S3ASSETS_BUCKET_NAME",
        //   "TOU_TM_S3ASSETS_DOMAIN",
        //   "TOU_SOLR_SERVER_PORT",
      ],
      // additionalSecretsFromParameterStore: { 
      //   "TOU_DATABASE_WRITER_HOSTNAME": "/RDS/Endpoint/Write",
      //   "TOU_REDIS_HOSTNAME": "/Redis/Endpoint/Primary",
      //   "TOU_SOLR_SERVER_HOSTNAME": "/Solr/Endpoint/Write",
      //   "TOU_TM_CLOUDFRONT_APIKEY": "/ServiceIamUsers/Parameters/cloudfrontService/AccessKeyId",
      //   "TOU_TM_CLOUDFRONT_APISECRET": "/ServiceIamUsers/Parameters/cloudfrontService/SecretAccessKey",
      //   "TOU_TM_CLOUDFRONT_DISTRIBUTION_IDS": "/CloudFront/DistributionIds",
      // },
    }

    const ecs = new TmEcsStack(this, `TmEcs${regionName}Stack`, ecsStackProps);

    // CLOUDFRONT

    const cloudfrontEnv = {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: 'us-east-1',
    }

    const cloudfrontStackProps: TmCloudfrontStackProps = {
      env: cloudfrontEnv,
      crossRegionReferences: true,
      retainLogBuckets: false,
      loadBalancerOriginProtocol: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
      applicationLoadbalancersDnsName: ecs.loadbalancer.loadBalancerDnsName,
      hostedZoneIdParameterName: '/avatar/cloudfrontStack/parameters/hostedZoneId',
      customHttpHeaderParameterName: '/avatar/cloudfrontStack/parameters/customHttpHeader',
      domainNameParameterName: '/avatar/cloudfrontStack/parameters/domanName',
      basicAuthEnabled: false,
      // basicAuthBase64: '/cloudfrontStack/parameters/basicAuthBase64',
    }

    new TmCloudfrontStack(this, 'TmCloudfrontUsEast1Stack', cloudfrontStackProps);





  }

  private applyNagChecks(stack: cdk.Stack): void {
    cdk.Aspects.of(stack).add(new AwsSolutionsChecks());
    NagSuppressions.addStackSuppressions(stack, [
      // RDS stack
      { id: 'AwsSolutions-IAM4', reason: 'The IAM user, role, or group uses AWS managed policies.' },
      { id: 'AwsSolutions-SMG4', reason: 'The secret does not have automatic rotation scheduled.' },
      { id: 'AwsSolutions-RDS6', reason: 'The RDS Aurora MySQL/PostgresSQL cluster does not have IAM Database Authentication enabled.' },
      { id: 'AwsSolutions-RDS10', reason: 'AwsSolutions-RDS10: The RDS instance or Aurora DB cluster does not have deletion protection enabled.' },
      { id: 'AwsSolutions-RDS11', reason: 'The RDS instance or Aurora DB cluster uses the default endpoint port.' },
      { id: 'AwsSolutions-RDS14', reason: 'The RDS Aurora MySQL cluster does not have Backtrack enabled.' },
      // Redis stack
      { id: 'AwsSolutions-AEC3', reason: 'It does not have both encryption in transit and at rest enabled.' },
      { id: 'AwsSolutions-AEC4', reason: 'It not deployed in a Multi-AZ configuration.' },
      { id: 'AwsSolutions-AEC5', reason: 'It uses the default endpoint port.' },
      { id: 'AwsSolutions-AEC6', reason: 'It does not use Redis AUTH for user authentication.' },
      // Bastion stack
      { id: 'AwsSolutions-IAM5', reason: 'The IAM entity contains wildcard permissions.' },
      { id: 'AwsSolutions-EC26', reason: 'EBS volumes that have encryption disabled.' },
      { id: 'AwsSolutions-EC28', reason: 'The EC2 instance does not have detailed monitoring enabled.' },
      { id: 'AwsSolutions-EC29', reason: 'The EC2 instance does not have termination protection enabled.' },
      { id: 'AwsSolutions-L1', reason: 'The non-container Lambda function is not configured to use the latest runtime version.' },
      // ECS stack
      { id: 'AwsSolutions-ELB2', reason: 'The ELB does not have access logs enabled.' },
      { id: 'AwsSolutions-ECS4', reason: ' The ECS Cluster has CloudWatch Container Insights disabled.' },
    ]);
  }

}