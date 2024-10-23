import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class ApplyRemovalPolicyAspect implements cdk.IAspect {
  constructor(private readonly policy: cdk.RemovalPolicy) { }

  public visit(node: Construct): void {
    if (node instanceof cdk.CfnResource) {
      const cfnResource = node as cdk.CfnResource;
      cfnResource.applyRemovalPolicy(this.policy);
    }
  }
}

export function getRemovalPolicy(policy: string): cdk.RemovalPolicy {
  switch (policy.toUpperCase()) {
    case 'DESTROY':
      return cdk.RemovalPolicy.DESTROY;
    case 'RETAIN':
      return cdk.RemovalPolicy.RETAIN;
    default:
      throw new Error(`Unknown removal policy: ${policy}`);
  }
}