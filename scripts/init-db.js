const { DynamoDBClient, CreateTableCommand } = require("@aws-sdk/client-dynamodb");

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" });

async function createTable() {
  try {
    const data = await client.send(
      new CreateTableCommand({
        TableName: "PokerMTTTracker",
        KeySchema: [
          { AttributeName: "id", KeyType: "HASH" }, // Partition key
        ],
        AttributeDefinitions: [
          { AttributeName: "id", AttributeType: "S" },
        ],
        BillingMode: "PAY_PER_REQUEST",
      })
    );
    console.log("Table created successfully:", data);
  } catch (err) {
    if (err.name === "ResourceInUseException") {
      console.log("Table already exists.");
    } else {
      console.error("Error creating table:", err);
    }
  }
}

createTable();
