import { useEffect, useState } from "react";

type RouteName = "assets" | "assetDetail" | "dashboard" | "risks" | "riskDetail" | "projects" | "projectDetail" | "users" | "notFound";

type RouteMatch = {
  name: RouteName;
  params: Record<string, string>;
};

const routes: Array<{ name: RouteName; pattern: string }> = [
  { name: "dashboard", pattern: "/dashboard" },
  { name: "assets", pattern: "/assets" },
  { name: "assetDetail", pattern: "/assets/:id" },
  { name: "risks", pattern: "/risks" },
  { name: "riskDetail", pattern: "/risks/:id" },
  { name: "projects", pattern: "/projects" },
  { name: "projectDetail", pattern: "/projects/:id" },
  { name: "users", pattern: "/users" },
];

function matchRoute(pathname: string): RouteMatch {
  if (pathname === "/") return { name: "assets", params: {} };

  const pathSegments = pathname.split("/").filter(Boolean);

  for (const route of routes) {
    const patternSegments = route.pattern.split("/").filter(Boolean);
    if (patternSegments.length !== pathSegments.length) continue;

    const params: Record<string, string> = {};
    const isMatch = patternSegments.every((segment, index) => {
      const pathSegment = pathSegments[index];
      if (segment.startsWith(":")) {
        params[segment.slice(1)] = decodeURIComponent(pathSegment);
        return true;
      }
      return segment === pathSegment;
    });

    if (isMatch) return { name: route.name, params };
  }

  return { name: "notFound", params: {} };
}

export function navigate(path: string) {
  window.history.pushState(null, "", path);
  window.dispatchEvent(new Event("aibom:navigate"));
}

export function useRoute() {
  const [route, setRoute] = useState(() => matchRoute(window.location.pathname));

  useEffect(() => {
    const updateRoute = () => setRoute(matchRoute(window.location.pathname));
    window.addEventListener("popstate", updateRoute);
    window.addEventListener("aibom:navigate", updateRoute);
    return () => {
      window.removeEventListener("popstate", updateRoute);
      window.removeEventListener("aibom:navigate", updateRoute);
    };
  }, []);

  return route;
}
