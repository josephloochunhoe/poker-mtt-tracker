import { NextResponse } from "next/server";
import { docClient, TABLE_NAME } from "@/lib/dynamodb";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

const CACHE_KEY = "CURRENCY_RATES_CACHE";
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const EXCHANGE_API_URL = "https://open.er-api.com/v6/latest/USD";

export async function GET() {
  try {
    // Check DynamoDB cache
    const cached = await docClient.send(
      new GetCommand({ TableName: TABLE_NAME, Key: { TournamentId: CACHE_KEY } })
    );

    if (cached.Item) {
      const ageMs = Date.now() - new Date(cached.Item.cachedAt).getTime();
      if (ageMs < CACHE_TTL_MS) {
        return NextResponse.json({ rates: cached.Item.rates, base: cached.Item.base, cachedAt: cached.Item.cachedAt });
      }
    }

    // Fetch fresh rates
    const res = await fetch(EXCHANGE_API_URL);
    if (!res.ok) throw new Error(`Exchange API returned ${res.status}`);
    const data = await res.json();

    const cachedAt = new Date().toISOString();
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: { TournamentId: CACHE_KEY, rates: data.rates, base: data.base_code ?? "USD", cachedAt },
      })
    );

    return NextResponse.json({ rates: data.rates, base: data.base_code ?? "USD", cachedAt });
  } catch (error: any) {
    console.error("Currency rates error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch currency rates" }, { status: 500 });
  }
}
