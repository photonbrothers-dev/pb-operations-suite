import { NextRequest, NextResponse } from "next/server";
import { fetchAllProjects, calculateStats } from "@/lib/hubspot";

// Reuse projects cache
let statsCache: {
  data: ReturnType<typeof calculateStats> | null;
  timestamp: number;
} = {
  data: null,
  timestamp: 0,
};

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const authHeader = request.headers.get("authorization");
    const expectedToken = process.env.API_SECRET_TOKEN;

    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const forceRefresh = request.nextUrl.searchParams.get("refresh") === "true";

    // Check cache
    const now = Date.now();
    if (
      !forceRefresh &&
      statsCache.data &&
      now - statsCache.timestamp < CACHE_TTL
    ) {
      return NextResponse.json({
        ...statsCache.data,
        cached: true,
      });
    }

    // Fetch fresh data
    const projects = await fetchAllProjects();
    const stats = calculateStats(projects);

    statsCache = {
      data: stats,
      timestamp: now,
    };

    return NextResponse.json({
      ...stats,
      cached: false,
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
