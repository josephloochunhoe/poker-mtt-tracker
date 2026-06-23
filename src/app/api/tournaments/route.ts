import { NextResponse } from "next/server";
import { docClient, TABLE_NAME } from "@/lib/dynamodb";
import { ScanCommand, PutCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";

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
    const body = await request.json();

    const command = new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...body,
        // Ensure your Partition Key is present
        TournamentId: body.id || `wpt_${Date.now()}`,
      },
    });

    await docClient.send(command);
    return NextResponse.json({ success: true, message: "Saved successfully!" });

  } catch (error: any) {
    // 🔴 AMEND THIS LINE RIGHT HERE:
    // Instead of returning a generic error, we strip open the AWS system error message
    console.error("DynamoDB Error Caught:", error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Unknown server error",
        code: error.code || error.__type || "No error code provided",
        stack: error.stack // Optional: gives you the exact line number that failed
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { action, id, ...rest } = body;

    if (action === "REBUY") {
      const { bullets } = rest;
      await docClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { TournamentId: id },
          UpdateExpression: `SET bullets = :bullets`,
          ExpressionAttributeValues: {
            ":bullets": bullets,
          },
        })
      );
      return NextResponse.json({ success: true });
    } else if (action === "COMPLETE") {
      const { finishPosition, fieldSize, cashWon, bountiesWon, bullets, status } = rest;
      await docClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { TournamentId: id },
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
  } catch (error: any) {
    console.error("PUT Error:", error);
    return NextResponse.json(
      {
        error: `Failed to update tournament: ${error?.message || "Unknown error"}`,
        details: error?.message || "Unknown error",
        code: error?.code || error?.__type || "UnknownCode",
        stack: error?.stack,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing tournament id" }, { status: 400 });
    }

    await docClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { TournamentId: id },
      })
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE Error:", error);
    return NextResponse.json(
      {
        error: `Failed to delete tournament: ${error?.message || "Unknown error"}`,
        code: error?.code || error?.__type || "UnknownCode",
      },
      { status: 500 }
    );
  }
}
