import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as iam from 'aws-cdk-lib/aws-iam';

interface TmSolrEc2StackPropos extends cdk.StackProps {
  vpc: ec2.IVpc;
  hostedZone?: route53.IHostedZone;
  instanceSize?: string;
  ebsVolumeSize?: number;
}

export class TmSolrEc2Stack extends cdk.Stack {

    public readonly securityGroup: ec2.ISecurityGroup;

    constructor(scope: Construct, id: string, props: TmSolrEc2StackPropos) {
      super(scope, id, props);

        const ebsVolumeSize = props.ebsVolumeSize || 20;
        const instanceSize = props.instanceSize || 't3.medium';

        this.securityGroup = new ec2.SecurityGroup(this, 'SolrSecurityGroup', {
            vpc: props.vpc,
            allowAllOutbound: true,
        });

        /*
        const machineImage = ec2.MachineImage.fromSsmParameter(
          '/aws/service/ami-amazon-linux-latest/al2022-ami-kernel-default-x86_64',
          { os: ec2.OperatingSystemType.LINUX }
        );
        */

        const solr = new ec2.Instance(this, 'Solr', {
            instanceType: new ec2.InstanceType(instanceSize),
            //machineImage: new ec2.AmazonLinuxImage(),
            machineImage: new ec2.AmazonLinux2023ImageSsmParameter(),
            vpc: props.vpc,
            vpcSubnets: {
                subnetType: ec2.SubnetType.PUBLIC,  // Launch EC2 in public subnet
              },
            securityGroup: this.securityGroup,
            blockDevices: [{
              deviceName: '/dev/xvda',                               // Device name in the instance
              volume: ec2.BlockDeviceVolume.ebs( ebsVolumeSize , {  // 20 GB EBS volume
                volumeType: ec2.EbsDeviceVolumeType.GP3,            // Specify gp3 volume type                          
                deleteOnTermination: false,                         // Delete the volume when the instance is terminated
                encrypted: true,                                    // Enable encryption
              }),
            }],
        });

        solr.role.addManagedPolicy(
          iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')
        );

        if (props.hostedZone) {
          const privateHostedZone = props.hostedZone;
          const route53Record = new route53.ARecord(this, 'SolrRecord', {
            zone: privateHostedZone,
            target: route53.RecordTarget.fromIpAddresses(solr.instancePrivateIp),
            recordName: 'solr', // Will create solr.example.internal
          })

          new ssm.StringParameter(this, 'EndpointSolrWrite', {
            parameterName: '/Solr/Endpoint/Write',
            stringValue: route53Record.domainName,

          });
        }

    }
}
