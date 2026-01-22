import { NextRequest, NextResponse } from "next/server";
import { fetchAllProjects, calculateStats, filterProjectsForContext, type Project } from "@/lib/hubspot";

// Cache for projects
let projectsCache: {
  data: Project[] | null;
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

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const location = searchParams.get("location");
    const stage = searchParams.get("stage");
    const context = searchParams.get("context") as "scheduling" | "equipment" | "pe" | "executive" | "at-risk" | "all" | null;
    const activeOnly = searchParams.get("active") !== "false"; // Default to active only
    const includeStats = searchParams.get("stats") === "true";
    const forceRefresh = searchParams.get("refresh") === "true";

    // Check cache
    const now = Date.now();
    if (
      !forceRefresh &&
      projectsCache.data &&
      now - projectsCache.timestamp < CACHE_TTL
    ) {
      // Use cached data
    } else {
      // Fetch fresh data from HubSpot
      projectsCache = {
        data: await fetchAllProjects({ activeOnly: false }), // Fetch all, filter later
        timestamp: now,
      };
    }

    let projects = projectsCache.data || [];

    // Apply context filter first (if provided)
    if (context) {
      projects = filterProjectsForContext(projects, context);
    } else if (activeOnly) {
      // Default to active projects only
      projects = projects.filter((p) => p.isActive);
    }

    // Apply additional filters
    if (location) {
      projects = projects.filter((p) => p.pbLocation === location);
    }
    if (stage) {
      projects = projects.filter((p) => p.stage === stage);
    }

    // Sort by priority score (highest first)
    projects = projects.sort((a, b) => b.priorityScore - a.priorityScore);

    // Calculate stats if requested
    const stats = includeStats ? calculateStats(projects) : undefined;

    return NextResponse.json({
      projects,
      count: projects.length,
      stats,
      cached: now - projectsCache.timestamp < CACHE_TTL && !forceRefresh,
      lastUpdated: new Date(projectsCache.timestamp).toISOString(),
    });
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects", details: String(error) },
      { status: 500 }
    );
  }
}
