import { NextResponse } from "next/server";
import { docClient, TABLE_NAME } from "@/lib/dynamodb";
import { ScanCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

export async function GET() {
  try {
    const data = await docClient.send(new ScanCommand({ TableName: TABLE_NAME }));
    // Sort by date descending
    const tournaments = (data.Items || []).sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
    return NextResponse.json({ tournaments });
  } catch (error) {
    console.error("GET Error:", error);
    return NextResponse.json({ error: "Failed to fetch tournaments" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const tournament = await request.json();
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: tournament,
      })
    );
    return NextResponse.json({ success: true, tournament });
  } catch (error) {
    console.error("POST Error:", error);
    return NextResponse.json({ error: "Failed to create tournament" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { action, id, ...rest } = body;

    if (action === "REBUY") {
      const { newBullet, lastBulletIndex, bustedAt } = rest;
      await docClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { id },
          UpdateExpression: `SET bullets[${lastBulletIndex}].bustedAt = :bustedAt, bullets = list_append(bullets, :newBullet)`,
          ExpressionAttributeValues: {
            ":bustedAt": bustedAt,
            ":newBullet": [newBullet],
          },
        })
      );
      return NextResponse.json({ success: true });
    } else if (action === "COMPLETE") {
      const { finishPosition, fieldSize, cashWon, bountiesWon, bullets, status } = rest;
      await docClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { id },
          UpdateExpression:
            "SET #st = :status, finishPosition = :fp, fieldSize = :fs, cashWon = :cw, bountiesWon = :bw, bullets = :bullets",
          ExpressionAttributeNames: {
            "#st": "status",
          },
          ExpressionAttributeValues: {
            ":status": status,
            ":fp": finishPosition,
            ":fs": fieldSize,
            ":cw": cashWon,
            ":bw": bountiesWon,
            ":bullets": bullets,
          },
        })
      );
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("PUT Error:", error);
    return NextResponse.json({ error: "Failed to update tournament" }, { status: 500 });
  }
}
