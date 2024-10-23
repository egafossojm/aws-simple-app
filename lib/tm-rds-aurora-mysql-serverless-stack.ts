import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { TmRdsAuroraMysqlServerless } from 'tm-cdk-constructs';
import { NagSuppressions } from 'cdk-nag';

interface TmRdsAuroraMysqlServerlessStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  bastionHost: ec2.SecurityGroup;
  enableGlobal?: boolean;
}

export class TmRdsAuroraMysqlServerlessStack extends cdk.Stack {
  public readonly securityGroup: ec2.ISecurityGroup;
  constructor(scope: Construct, id: string, props: TmRdsAuroraMysqlServerlessStackProps) {
    super(scope, id, props);

    const cluster = new TmRdsAuroraMysqlServerless(this, 'Database', {
      engine: rds.DatabaseClusterEngine.auroraMysql({ 
        version: rds.AuroraMysqlEngineVersion.VER_3_05_2,
      }),
      vpc: props.vpc,
      enableGlobal: props.enableGlobal,
    });

    cluster.connections.allowFrom(props.bastionHost, ec2.Port.tcp(3306));
    
    cluster.metricServerlessDatabaseCapacity({
      period: cdk.Duration.minutes(10),
    }).createAlarm(this, 'capacity', {
        threshold: 1.5,
        evaluationPeriods: 3,
    });
    cluster.metricACUUtilization({
      period: cdk.Duration.minutes(10),
    }).createAlarm(this, 'alarm', {
      evaluationPeriods: 3,
      threshold: 90,
    });

    new ssm.StringParameter(this, 'clusterRdsArn', {
      parameterName: '/RDS/Cluster/ARN',
      stringValue: cluster.clusterArn,
    });

    new ssm.StringParameter(this, 'clusterRdsWrite', {
      parameterName: '/RDS/Endpoint/Write',
      stringValue: cluster.clusterEndpoint.hostname,
    });

    new ssm.StringParameter(this, 'clusterRdsRead', {
      parameterName: '/RDS/Endpoint/Read',
      stringValue: cluster.clusterReadEndpoint.hostname,
    });

    this.securityGroup = cluster.connections.securityGroups[0];


  }
}