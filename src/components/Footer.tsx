import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="bg-[#0A1428] text-slate-300 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="md:col-span-1">
            <p className="font-display text-xl font-bold text-white tracking-tight">Alba</p>
            <p className="mt-3 text-sm text-slate-400 leading-relaxed">
              Plan Together. Explore More. Save Smarter. Built by Alba Ltd. for group outing
              captains across Bengaluru and upcoming Indian metro hubs.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Platform</h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/planner" className="hover:text-white transition-colors">
                  AI Itinerary Builder
                </Link>
              </li>
              <li>
                <Link to="/explore" className="hover:text-white transition-colors">
                  Explore Bengaluru Venues
                </Link>
              </li>
              <li>
                <Link to="/discover-video" className="hover:text-white transition-colors">
                  Video Venue Discovery
                </Link>
              </li>
              <li>
                <Link to="/account" className="hover:text-white transition-colors">
                  Customer Dashboard
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Partners & Operations</h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/partner" className="hover:text-white transition-colors">
                  Venue Partner Portal
                </Link>
              </li>
              <li>
                <Link to="/admin" className="hover:text-white transition-colors">
                  Admin Command Centre
                </Link>
              </li>
              <li>
                <a href="#price-lock" className="hover:text-white transition-colors">
                  Advance Price-Lock Terms
                </a>
              </li>
              <li>
                <a href="#contact-support" className="hover:text-white transition-colors">
                  Contact & Support
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Launch Market</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Live Launch: Bengaluru, Karnataka
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Expanding soon to Mumbai, Delhi-NCR, and Pune.
            </p>
            <p className="mt-4 text-xs text-slate-400">
              Concierge Desk: concierge@alba-trips.in
            </p>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Alba Ltd. All rights reserved.</p>
          <p>DGU Venture Quest Platform · Bengaluru Rollout</p>
        </div>
      </div>
    </footer>
  );
}
