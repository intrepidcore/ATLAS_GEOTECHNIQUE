/**
 * Simple hash-based router for SPA navigation
 */

type RouteHandler = () => void | Promise<void>;

class Router {
  private routes: Map<string, RouteHandler> = new Map();
  private currentRoute: string = '/';

  constructor() {
    window.addEventListener('hashchange', () => this.handleRouteChange());
    window.addEventListener('load', () => this.handleRouteChange());
  }

  /**
   * Register a route handler
   */
  on(path: string, handler: RouteHandler) {
    this.routes.set(path, handler);
  }

  /**
   * Navigate to a route
   */
  navigate(path: string) {
    window.location.hash = path;
  }

  /**
   * Get current route
   */
  getCurrentRoute(): string {
    return this.currentRoute;
  }

  /**
   * Handle route changes
   */
  private async handleRouteChange() {
    const hash = window.location.hash.slice(1) || '/';
    this.currentRoute = hash;

    console.log('[ROUTER] Navigating to:', hash);

    // Extraire le path sans les query params pour le matching
    const [path] = hash.split('?');
    
    // Find matching route (match sur le path, pas les query params)
    const handler = this.routes.get(path);
    if (handler) {
      try {
        await handler();
      } catch (e) {
        console.error('[ROUTER] Error handling route:', hash, e);
      }
    } else {
      console.warn('[ROUTER] No handler for route:', hash);
      // Fallback to home
      if (path !== '/') {
        this.navigate('/');
      }
    }
  }
  
  /**
   * Get query params from current route
   */
  getQueryParams(): URLSearchParams {
    const hash = window.location.hash.slice(1) || '/';
    const queryIndex = hash.indexOf('?');
    if (queryIndex === -1) return new URLSearchParams();
    return new URLSearchParams(hash.slice(queryIndex + 1));
  }
}

// Export singleton instance
export const router = new Router();
