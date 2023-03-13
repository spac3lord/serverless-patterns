import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CfnPipe } from 'aws-cdk-lib/aws-pipes';
import { EventBus } from 'aws-cdk-lib/aws-events';
import { Rule, Match } from 'aws-cdk-lib/aws-events';
import { Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { AttributeType, BillingMode, StreamViewType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { RemovalPolicy } from 'aws-cdk-lib';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime, StartingPosition } from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import { CloudWatchLogGroup } from 'aws-cdk-lib/aws-events-targets';

const TABLE_NAME = 'Orders-Table';  // the DynamoDB table to be created
const EVENTBUS_NAME = 'ticket-orders'; // the event bus to be created
const LAMBDA_SOURCE = 'newsplit.ts';  // source for Lambda function
const LOGGROUP_NAME = '/aws/events/tickets'; // the CLoudWatch log group to be created


export class EventBridgePipesUniversalSplitter extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // log group to see Splitter output
    const ticketLogGroup = new LogGroup(this, 'tickets-log', {
      logGroupName: LOGGROUP_NAME,
      retention: RetentionDays.ONE_DAY
    });

    const ticketOrdersBus = new EventBus(this, 'bus-' + EVENTBUS_NAME, {
      eventBusName: EVENTBUS_NAME,
    });

    // Rule that matches any incoming event and sends it to a logGroup
    const catchAll = new Rule(this, 'send-to-log', {
      eventBus: ticketOrdersBus,
      ruleName: 'catchall',
      eventPattern: {
        source:  Match.exists()
      },
      targets: [new CloudWatchLogGroup(ticketLogGroup)]
    } );

    const eventBridgeRole = new Role(this, 'events-role', {
      assumedBy: new ServicePrincipal('events.amazonaws.com'),
    });

    ticketLogGroup.grantWrite(eventBridgeRole);

    // table for the orders.
    const ordersTable = new Table(this, 'table-' + TABLE_NAME, {
      partitionKey: { name: 'id', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
      tableName: TABLE_NAME,
      stream: StreamViewType.NEW_IMAGE,
    });

    // Lambda function that splits the order into seperate events.
    const splitterFunc: NodejsFunction = new NodejsFunction(this, 'lambda-newsplitter', {
      memorySize: 256,
      runtime: Runtime.NODEJS_18_X,
      handler: 'handler',
      entry: path.join(__dirname, '../src', LAMBDA_SOURCE),
      environment: {
        SPLIT_PATH: '$.tickets', 
        PROPAGATE: '$.id;$.userId',
        PREFIX: 'common_'
      }
    });

    const pipeRole = new Role(this, 'pipe-role', {
      assumedBy: new ServicePrincipal('pipes.amazonaws.com'),
    });

    ordersTable.grantStreamRead(pipeRole);
    ticketOrdersBus.grantPutEventsTo(pipeRole);
    splitterFunc.grantInvoke(pipeRole);

    // Create new Pipe
    const pipe = new CfnPipe(this, 'pipe', {
      roleArn: pipeRole.roleArn,
      //@ts-ignore
      source: ordersTable.tableStreamArn,
      sourceParameters: {
        dynamoDbStreamParameters: {
          startingPosition: StartingPosition.LATEST,
          maximumBatchingWindowInSeconds: 10
        },
        filterCriteria: {
          filters: [
            {
              pattern: '{"eventName" : ["INSERT"] }',
            },
          ],
        },
      },
      enrichment: splitterFunc.functionArn,
      target: ticketOrdersBus.eventBusArn,
      targetParameters: {
        eventBridgeEventBusParameters: {
          detailType: 'TicketPurchased',
          source: 'trains.tickets',
        },
      },
    });
  }
}
