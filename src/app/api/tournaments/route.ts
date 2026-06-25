import { NextResponse } from "next/server";
import { docClient, TABLE_NAME } from "@/lib/dynamodb";
import { ScanCommand, PutCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";

export async function GET() {
  try {
    const data = await docClient.send(new ScanCommand({ TableName: TABLE_NAME }));
    // Sort by date descending
    const tournaments = (data.Items || [])
      .filter(item => item.recordType !== "wallet")
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
        TournamentId: body.id || `tournament_${Date.now()}`,
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
      const { finishPosition, fieldSize, cashWon, bountiesWon, bullets, status, flightStatus } = rest;
      // Build the update dynamically so optional fields (finish position, field size,
      // flight status) are only written when present — e.g. bagged/advanced Day 1 flights
      // intentionally have no finish position or field size.
      const setClauses = ["#st = :status", "cashWon = :cw", "bountiesWon = :bw", "bullets = :bullets"];
      const names: Record<string, string> = { "#st": "status" };
      const values: Record<string, unknown> = {
        ":status": status,
        ":cw": cashWon,
        ":bw": bountiesWon,
        ":bullets": bullets,
      };
      if (finishPosition !== undefined && finishPosition !== null) {
        setClauses.push("finishPosition = :fp");
        values[":fp"] = finishPosition;
      }
      if (fieldSize !== undefined && fieldSize !== null) {
        setClauses.push("fieldSize = :fs");
        values[":fs"] = fieldSize;
      }
      if (flightStatus !== undefined && flightStatus !== null) {
        setClauses.push("flightStatus = :fls");
        values[":fls"] = flightStatus;
      }
      await docClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { TournamentId: id },
          UpdateExpression: "SET " + setClauses.join(", "),
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: values,
        })
      );
      return NextResponse.json({ success: true });
    } else if (action === "COMPLETE_CASH") {
      const { cashOut, bullets, status } = rest;
      await docClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { TournamentId: id },
          UpdateExpression: "SET #st = :status, cashOut = :cashOut, bullets = :bullets",
          ExpressionAttributeNames: { "#st": "status" },
          ExpressionAttributeValues: {
            ":status": status,
            ":cashOut": cashOut,
            ":bullets": bullets,
          },
        })
      );
      return NextResponse.json({ success: true });
    } else if (action === "LINK_FLIGHT") {
      // Link an additional Day 1 flight into an existing Day 2 record.
      // `id` is the Day 2's TournamentId; `day1Id` is the Day 1 flight to append.
      const { day1Id } = rest;
      await docClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { TournamentId: id },
          UpdateExpression:
            "SET additionalParentIds = list_append(if_not_exists(additionalParentIds, :empty), :new)",
          ExpressionAttributeValues: {
            ":empty": [],
            ":new": [day1Id],
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
