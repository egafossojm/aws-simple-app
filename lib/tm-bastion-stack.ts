import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

interface TmBastionStackPropos extends cdk.StackProps {
  vpc: ec2.IVpc;
}

export class TmBastionStack extends cdk.Stack {
    public readonly securityGroup: ec2.SecurityGroup;

    constructor(scope: Construct, id: string, props: TmBastionStackPropos) {
      super(scope, id, props);

        this.securityGroup = new ec2.SecurityGroup(this, 'BastionSecurityGroup', {
            vpc: props.vpc,
            allowAllOutbound: true,
        });

        new ec2.BastionHostLinux(this, 'Bastion', {
            vpc: props.vpc,
            subnetSelection: { subnetType: ec2.SubnetType.PUBLIC },
            securityGroup: this.securityGroup,
        });

    }
}
