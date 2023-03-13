import { unmarshall } from '@aws-sdk/util-dynamodb';
import { DynamoDBRecord } from 'aws-lambda';
import { AttributeValue } from '@aws-sdk/client-dynamodb';
import { JSONPath, JSONPathOptions } from 'jsonpath-plus';

// Split an object by the specified node and copy a list of specified nodes into each part,
// prepended with an optional prefix to avoid field name collisions.
// Paths are JSONPath, e.g. '$.id'
function split (data: any, splitPath: string, propagatePaths: string[] = [], propagatePrefix : string = "") : Record<string, any> {
  // Build a list of key-value pairs of all (valid) properties to propagate down.
  var propagate : Record<string,any> = {}
  propagatePaths.forEach( (path : string) => {
    const fieldName = JSONPath({path: path, json: data, wrap: false, resultType: "parentProperty"})
    if (fieldName) {
      // propagate.push({key: fieldName, value: JSONPath({path: path, json: data, wrap: false} as JSONPathOptions)})
      propagate[propagatePrefix + fieldName] = JSONPath({path: path, json: data, wrap: false} as JSONPathOptions)
    }}
  )
  // Split the object into parts.
  const parts = JSONPath({path: splitPath, json: data, wrap: false})
  if (parts) {
    return parts.map( (part: Record<string,any>) => {
      // Propagate the common fields into each copy
      return { ...part, ...propagate} 
    } ) 
  } else {
    return []
  }
}

// Get rid of source specifics
// TODO: don't assume a single record is passed in (brittle)
// TODO: detect the source and handle different cases like DDB Stream, SQS, etc
function normalize (records: DynamoDBRecord[]) : Record<string, any> {
  // NewImage will use the aws-lambda AttributeValue and has to be cast to the client-dynamodb one
  const newItem = (records[0]?.dynamodb?.NewImage as { [key: string]: AttributeValue }) || {};
  return unmarshall(newItem);
}

export async function handler(records: DynamoDBRecord[]) {
  console.log(records[0])
  const data = normalize(records)
  return split(data, '$.tickets', ['$.id', '$.userId'], 'common_')
}
