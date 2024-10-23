import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { TmElasticacheRedisCluster } from 'tm-cdk-constructs';

interface TmRedisStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  allowFromConstructs?: { [key: string]: ec2.IConnectable  };
}

export class TmRedisStack extends cdk.Stack {
  public readonly securityGroup: ec2.ISecurityGroup;
  constructor(scope: Construct, id: string, props?: TmRedisStackProps) {
    super(scope, id, props);

    const redisCluster = new TmElasticacheRedisCluster(this, 'TmRedisCluster', {
      envName: 'tm',
      vpc: props!.vpc,
      clusterMode: 'Disabled',
      cacheNodeType: 'cache.t3.micro',
      allowFromConstructs: props?.allowFromConstructs,
    });

    // Only to cluster mode disabled
    // to cluster mode enabled, use redisCluster.cluster.attrConfigurationEndPointAddress
    new ssm.StringParameter(this, 'RedisPrimaryEndpoint', {
      parameterName: '/Redis/Endpoint/Primary',
      stringValue: redisCluster.cluster.attrPrimaryEndPointAddress,
    });

    this.securityGroup = redisCluster.securityGroup;
  }
}