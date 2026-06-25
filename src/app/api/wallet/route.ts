import { NextResponse } from "next/server";
import { docClient, TABLE_NAME } from "@/lib/dynamodb";
import { ScanCommand, PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";

export async function GET() {
  try {
    const data = await docClient.send(new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: "recordType = :rt",
      ExpressionAttributeValues: { ":rt": "wallet" },
    }));
    const transactions = (data.Items || []).sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    return NextResponse.json({ transactions });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const id = `wallet_${Date.now()}`;
    const item: Record<string, unknown> = {
      TournamentId: id,
      id,
      recordType: "wallet",
      user_id: "default",
      amount: body.amount,
      type: body.type,
      created_at: body.created_at,
    };
    if (body.currency) item.currency = body.currency;
    if (body.originalAmount != null) item.originalAmount = body.originalAmount;
    await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { TournamentId: id },
    }));
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
