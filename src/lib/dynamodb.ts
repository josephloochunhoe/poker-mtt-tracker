import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

// 1. Create a base configuration object
const clientConfig: any = {
  region: process.env.AWS_REGION || "ap-southeast-1",
};

// 2. ONLY attach the credentials object if the environment variables actually exist (Local Dev)
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  clientConfig.credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  };
}
// If they don't exist (Live on Amplify), leaving clientConfig.credentials completely undefined 
// forces the SDK to automatically fall back to your secure IAM Compute Role!

const client = new DynamoDBClient(clientConfig);

export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

export const TABLE_NAME = "PokerMTTTracker";