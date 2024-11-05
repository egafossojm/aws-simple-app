import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CfnOutput, Environment } from 'aws-cdk-lib';
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import { HttpOrigin, S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { TmCachePolicy, TmCachePolicyProps } from 'tm-cdk-constructs/lib/cdn';
import { HostedZone } from 'aws-cdk-lib/aws-route53';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';

export interface TmCloudfrontStackProps extends cdk.StackProps {
    readonly customHttpHeaderParameterName: string;
    readonly domainNameParameterName: string;
    readonly hostedZoneIdParameterName: string;
    readonly env: Environment;
    readonly retainLogBuckets?: boolean;
    readonly retainErrorBucket?: boolean;
    //readonly webAclId?: string;
    readonly errorCachingMinTtl?: number;
    readonly applicationLoadbalancersDnsName: string;
    readonly loadBalancerOriginProtocol?: cloudfront.OriginProtocolPolicy;
    readonly viewerProtocolPolicy?: cloudfront.ViewerProtocolPolicy;
    readonly enableAcceptEncodingBrotli?: boolean,
    readonly enableAcceptEncodingGzip?: boolean,
    readonly cachePolicyDefaultTtl?: number,
    readonly cachePolicyMaxTtl?: number,
    readonly cachePolicyMinTtl?: number,
    readonly additionalCookies?: string[];
    readonly additionalHeaders?: string[];
    readonly queryStrings?: string[];
    readonly basicAuthEnabled?: boolean;
    readonly basicAuthBase64?: string;
    //readonly errorBuckets: s3.Bucket[];
    //readonly logBuckets: s3.Bucket[];
}

export class TmCloudfrontStack extends cdk.Stack {

    // private certificate: Certificate;
    // private errorsBucketOrigins: S3Origin[] = [];
    // private loadBalancerOrigins: HttpOrigin[] = [];
    public readonly distribution: cloudfront.Distribution;


    constructor(scope: Construct, id: string, props: TmCloudfrontStackProps) {

        super(scope, id, props);

        const customHttpHeaderValue = ssm.StringParameter.valueForStringParameter(this, props.customHttpHeaderParameterName);
        const hostedZoneId = ssm.StringParameter.valueForStringParameter(this, props.hostedZoneIdParameterName);
        const domainName = ssm.StringParameter.valueForStringParameter(this, props.domainNameParameterName);
        const certificate = new acm.Certificate(this, 'Certificate', {
            domainName: domainName,
            validation: acm.CertificateValidation.fromDns(HostedZone.fromHostedZoneId(this, 'HostedZone', hostedZoneId)),
          });

          const httpOrigin = new HttpOrigin(props.applicationLoadbalancersDnsName, {
            protocolPolicy: props.loadBalancerOriginProtocol || cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
            customHeaders: {
                'X-Custom-Header': ssm.StringParameter.valueForStringParameter(this, props.customHttpHeaderParameterName),
            }
        });


        // Default Behavior Cache Policy
        // const tmCachePolicyProps: TmCachePolicyProps = {
        //     enableAcceptEncodingBrotli: props.enableAcceptEncodingBrotli,
        //     enableAcceptEncodingGzip: props.enableAcceptEncodingGzip,
        //     defaultTtl: cdk.Duration.seconds(props.cachePolicyDefaultTtl ?? 86400),
        //     maxTtl: cdk.Duration.seconds(props.cachePolicyMaxTtl ?? 31536000),
        //     minTtl: cdk.Duration.seconds(props.cachePolicyMinTtl ?? 0),
        //     additionalCookies: props.additionalCookies,
        //     additionalHeaders: props.additionalHeaders,
        //     queryStrings: props.queryStrings,

        // };
        
        // const functionAssociation: cloudfront.FunctionAssociation[] = [];

        // if (props.basicAuthEnabled){
        //     const basicAuthBase64 = ssm.StringParameter.valueForStringParameter(this, props.basicAuthBase64?.toString() ?? '');
        //     const BasicAuthFunction: string = `
        //     function handler(event) {
        //         var authHeaders = event.request.headers.authorization;
        //         // It is an encoding of \`Basic base64([username]:[password])\`
        //         var expected = "Basic ${basicAuthBase64}";
        //         if (authHeaders && authHeaders.value === expected) {
        //         return event.request;
        //         }
        //         var response = {
        //         statusCode: 401,
        //         statusDescription: "Unauthorized",
        //         headers: {
        //             "www-authenticate": {
        //             value: 'Basic realm="Authentification"',
        //             },
        //         },
        //         };
            
        //         return response;
        //     }
        //     `;

        //     const authFunction = new cloudfront.Function(this, 'BasicAuthFunction', {
        //         functionName: 'BasicAuthFunction',
        //         code: cloudfront.FunctionCode.fromInline(BasicAuthFunction),
        //     });

        //     functionAssociation.push({
        //         function: authFunction,
        //         eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
        //     });
        // } else {
        //     functionAssociation.filter(assoc => assoc.function);
        // }


        // Default Behavior
        const defaultBehavior: cloudfront.BehaviorOptions = {
            origin: httpOrigin,
            viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
            //cachePolicy: new TmCachePolicy(this, 'DefaultCachePolicy', tmCachePolicyProps),
            //functionAssociations: functionAssociation,
        }


        // Error Responses
        // const errorCodes: number[] = [400, 403, 500, 501, 502, 503, 504];
        // const errorResponsesObjects: cloudfront.ErrorResponse[] = [];
        // for (const code of errorCodes) {
        //     errorResponsesObjects.push(
        //         {
        //             httpStatus: code,
        //             responseHttpStatus: code,
        //             responsePagePath: `/errors/${code}.html`,
        //             ttl: cdk.Duration.seconds(30),
        //         }
        //     )
        // }

        // Distribution
        this.distribution = new cloudfront.Distribution(this, 'StagingCloudFrontDistribution', {
            domainNames: [domainName],
            priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
            //webAclId: props.webAclId,
            minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
            defaultBehavior: defaultBehavior,
            certificate: certificate
        });

        // Default TYPO3 Behavior
        // this.distribution.addBehavior('/typo3/*', this.loadBalancerOrigins[0], {
        //     allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        //     cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        //     viewerProtocolPolicy: props.viewerProtocolPolicy || cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        //     originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
        //     functionAssociations: functionAssociation,
        // });

        // Add additional behaviors for backup regions
        // this.loadBalancerOrigins.slice(1).forEach((origin, index) => {
        //     this.distribution.addBehavior(`/typo3-backup-region-${ index + 1 }/*`, origin, {
        //         allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        //         cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        //         viewerProtocolPolicy: props.viewerProtocolPolicy || cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        //         originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
        //         functionAssociations: functionAssociation,
        //     });
        // });

        // Default Error Behavior
        // this.distribution.addBehavior('/errors/*', this.errorsBucketOrigins[0], {
        //     viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        // });

        // Add additional behaviors for backup regions
        // this.errorsBucketOrigins.slice(1).forEach((origin, index) => {
        //     this.distribution.addBehavior(`/errors-backup-region-${index + 1}/*`, origin, {
        //         viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        //     });
        // });

        new CfnOutput(this, 'DistributionID', {
            value: this.distribution.distributionId,
        });

    }
}