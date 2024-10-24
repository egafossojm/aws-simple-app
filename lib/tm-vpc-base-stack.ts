import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { IVpc } from 'aws-cdk-lib/aws-ec2';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { TmVpcBase } from 'tm-cdk-constructs';

interface VpcBaseStackProps extends cdk.StackProps {
  range?: string;
  hostedZoneName?: string;
}

export class TmVpcBaseStack extends cdk.Stack {
  public readonly vpc: IVpc;
  //public readonly hostedZone: route53.IHostedZone;
  constructor(scope: Construct, id: string, props?: VpcBaseStackProps) {
    super(scope, id, props);


    this.vpc = new TmVpcBase(this, 'Vpc-CDK', {
      rangeCidr: props?.range || '10.1.0.0/16',
      enableEndpoints: ['s3'],

    });

    // this.hostedZone = new route53.PrivateHostedZone(this, 'PrivateHostedZone', {
    //   zoneName: props?.hostedZoneName || 'example.internal',
    //   vpc: this.vpc,
    // });

  }

}