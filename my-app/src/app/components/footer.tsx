import { Logo } from "./logo";
import { Link } from "react-router";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-card mt-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <Logo className="w-8 h-8 text-primary" />
              <span className="text-lg font-semibold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Knowing Eye
              </span>
            </div>
            <p className="text-sm text-muted-foreground max-w-md">
              A Web-Based Examination Platform with Behavior Monitoring Using
              Facial and Postural Analysis
            </p>
            <p className="text-xs text-muted-foreground mt-4">
              Legacy College of Compostela
              <br />
              Institute of Information Technology
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/" className="hover:text-primary transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link
                  to="/features"
                  className="hover:text-primary transition-colors"
                >
                  Features
                </Link>
              </li>
              <li>
                <Link
                  to="/dashboard"
                  className="hover:text-primary transition-colors"
                >
                  Dashboard
                </Link>
              </li>
              <li>
                <Link
                  to="/about"
                  className="hover:text-primary transition-colors"
                >
                  About
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold mb-4">Contact</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Compostela, Davao de Oro</li>
              <li>Philippines</li>
              <li className="pt-2">
                <a
                  href="mailto:info@knowingeye.edu"
                  className="hover:text-primary transition-colors"
                >
                  info@knowingeye.edu
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border text-center text-sm text-muted-foreground">
          <p>© {currentYear} Knowing Eye. All rights reserved.</p>
          <p className="mt-2">
            Developed by Saturnino C. Ancog III, Khrisha Marie O. Cavan, Kervy
            N. Cadiente, and Twixt Jasley J. Tamera
          </p>
        </div>
      </div>
    </footer>
  );
}
