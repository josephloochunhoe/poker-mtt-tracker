import { NextResponse } from "next/server";
import { docClient, TABLE_NAME } from "@/lib/dynamodb";
import { ScanCommand, GetCommand, PutCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";

/** Embedded tournament — kept loose here since this API is just a passthrough store. */
type StoredTournament = {
  id: string;
  additionalParentIds?: string[];
  [key: string]: unknown;
};

interface SessionItem {
  TournamentId: string;
  id: string;
  recordType: "session";
  sessionNumber?: number;
  name?: string;
  status: "Active" | "Completed";
  startedAt: string;
  endedAt?: string;
  tournaments: StoredTournament[];
}

/** Load a single session item by id, or null if it isn't a session. */
async function loadSession(id: string): Promise<SessionItem | null> {
  const res = await docClient.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { TournamentId: id } })
  );
  const item = res.Item as SessionItem | undefined;
  if (!item || item.recordType !== "session") return null;
  return item;
}

/** Persist the (possibly mutated) tournaments list back onto a session. */
async function saveTournaments(id: string, tournaments: StoredTournament[]) {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { TournamentId: id },
      UpdateExpression: "SET tournaments = :t",
      ExpressionAttributeValues: { ":t": tournaments },
    })
  );
}

export async function GET() {
  try {
    const data = await docClient.send(new ScanCommand({ TableName: TABLE_NAME }));
    const sessions = (data.Items || [])
      .filter(item => item.recordType === "session")
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("Sessions GET Error:", error);
    return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    // Determine the next sequential session number (ignore the Archive / un-numbered sessions).
    const data = await docClient.send(new ScanCommand({ TableName: TABLE_NAME }));
    const existing = (data.Items || []).filter(i => i.recordType === "session");
    const maxNumber = existing.reduce(
      (max, s) => (typeof s.sessionNumber === "number" && s.sessionNumber > max ? s.sessionNumber : max),
      0
    );

    const id = `session_${Date.now()}`;
    const session: SessionItem = {
      TournamentId: id,
      id,
      recordType: "session",
      sessionNumber: maxNumber + 1,
      status: "Active",
      startedAt: body.startedAt || new Date().toISOString(),
      tournaments: [],
    };

    await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: session }));
    return NextResponse.json({ success: true, session });
  } catch (error) {
    console.error("Sessions POST Error:", error);
    const message = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { action, sessionId, ...rest } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    if (action === "ADD_TOURNAMENT") {
      const session = await loadSession(sessionId);
      if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
      const tournaments = [...(session.tournaments || []), rest.tournament];
      await saveTournaments(sessionId, tournaments);
      return NextResponse.json({ success: true });
    }

    if (action === "REBUY") {
      const { tournamentId, bullets } = rest;
      const session = await loadSession(sessionId);
      if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
      const tournaments = (session.tournaments || []).map(t =>
        t.id === tournamentId ? { ...t, bullets } : t
      );
      await saveTournaments(sessionId, tournaments);
      return NextResponse.json({ success: true });
    }

    if (action === "COMPLETE") {
      const { tournamentId, finishPosition, fieldSize, cashWon, bountiesWon, bullets, status, flightStatus, review } = rest;
      const session = await loadSession(sessionId);
      if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
      const tournaments = (session.tournaments || []).map(t => {
        if (t.id !== tournamentId) return t;
        const updated: StoredTournament = { ...t, status: status ?? "Completed", cashWon, bountiesWon, bullets };
        // Only write optional fields when present — bagged/advanced Day 1 flights
        // intentionally have no finish position, field size, or cash.
        if (finishPosition !== undefined && finishPosition !== null) updated.finishPosition = finishPosition;
        if (fieldSize !== undefined && fieldSize !== null) updated.fieldSize = fieldSize;
        if (flightStatus !== undefined && flightStatus !== null) updated.flightStatus = flightStatus;
        if (review !== undefined && review !== null) updated.review = review;
        return updated;
      });
      await saveTournaments(sessionId, tournaments);
      return NextResponse.json({ success: true });
    }

    if (action === "LINK_FLIGHT") {
      // Append an additional Day 1 flight into an existing Day 2 record within this session.
      const { day2Id, day1Id } = rest;
      const session = await loadSession(sessionId);
      if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
      const tournaments = (session.tournaments || []).map(t =>
        t.id === day2Id
          ? { ...t, additionalParentIds: [...(t.additionalParentIds || []), day1Id] }
          : t
      );
      await saveTournaments(sessionId, tournaments);
      return NextResponse.json({ success: true });
    }

    if (action === "SET_REVIEW") {
      const { tournamentId, review } = rest;
      const session = await loadSession(sessionId);
      if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
      const tournaments = (session.tournaments || []).map(t =>
        t.id === tournamentId ? { ...t, review: review ?? "" } : t
      );
      await saveTournaments(sessionId, tournaments);
      return NextResponse.json({ success: true });
    }

    if (action === "DELETE_TOURNAMENT") {
      const { tournamentId } = rest;
      const session = await loadSession(sessionId);
      if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
      const tournaments = (session.tournaments || []).filter(t => t.id !== tournamentId);
      await saveTournaments(sessionId, tournaments);
      return NextResponse.json({ success: true });
    }

    if (action === "END_SESSION") {
      const session = await loadSession(sessionId);
      if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
      // An empty session is discarded rather than saved as a blank history card.
      if (!session.tournaments || session.tournaments.length === 0) {
        await docClient.send(
          new DeleteCommand({ TableName: TABLE_NAME, Key: { TournamentId: sessionId } })
        );
        return NextResponse.json({ success: true, deleted: true });
      }
      await docClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { TournamentId: sessionId },
          UpdateExpression: "SET #st = :status, endedAt = :endedAt",
          ExpressionAttributeNames: { "#st": "status" },
          ExpressionAttributeValues: { ":status": "Completed", ":endedAt": rest.endedAt || new Date().toISOString() },
        })
      );
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Sessions PUT Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Failed to update session: ${message}` }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing session id" }, { status: 400 });
    await docClient.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { TournamentId: id } }));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Sessions DELETE Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Failed to delete session: ${message}` }, { status: 500 });
  }
}
