import { Link } from "react-router";

import { brand } from "@/core/config/brand";
import { DepartmentLogo, InstitutionLogo, Logo } from "@/shared/components/layout/logo";

/*
 * The home page is set as an optical answer sheet: one printed form in LCC
 * green "dropout ink", a timing track down the edge, and the portal choice
 * asked as a multiple-choice item whose bubble shades in when picked.
 */

const portals = [
  {
    option: "A",
    title: "Examiner",
    description: "Create exams, monitor sessions, and review reports.",
    to: "/examiner",
  },
  {
    option: "B",
    title: "Examinee",
    description: "Take assigned exams and view your results.",
    to: "/examinee",
  },
];

const timingMarks = Array.from({ length: 22 }, (_, i) => `timing-mark-${i}`);

export function HomePage() {
  return (
    <section className="answer-sheet-page">
      <article className="answer-sheet" aria-labelledby="answer-sheet-title">
        <div className="answer-sheet-track" aria-hidden>
          {timingMarks.map((mark) => (
            <span key={mark} />
          ))}
        </div>

        <div className="answer-sheet-body">
          <header className="answer-sheet-letterhead">
            <div className="answer-sheet-seals">
              <InstitutionLogo className="answer-sheet-seal" />
              <DepartmentLogo className="answer-sheet-seal" />
            </div>
            <div className="answer-sheet-issuer">
              <p className="answer-sheet-institution">{brand.institutionName}</p>
              <p className="answer-sheet-unit">{brand.institutionUnit}</p>
            </div>
            <Logo className="answer-sheet-mark" />
          </header>

          <div className="answer-sheet-heading">
            <h1 id="answer-sheet-title" className="answer-sheet-title">
              {brand.appName}
            </h1>
            <p className="answer-sheet-tagline">{brand.tagline}</p>
            <p className="answer-sheet-description">
              Secure, monitored online examinations for {brand.institutionName}, built for fair
              assessment and academic integrity.
            </p>
          </div>

          <div className="answer-sheet-item">
            <h2 id="answer-sheet-question" className="answer-sheet-question">
              Choose your portal
            </h2>
            <ul className="answer-sheet-options" aria-labelledby="answer-sheet-question">
              {portals.map((portal) => (
                <li key={portal.title}>
                  <Link to={portal.to} className="answer-option">
                    <span className="answer-option-bubble" aria-hidden>
                      {portal.option}
                    </span>
                    <span className="answer-option-text">
                      <span className="answer-option-title">{portal.title}</span>
                      <span className="answer-option-description">{portal.description}</span>
                    </span>
                    <span className="answer-option-action">Open portal</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <footer className="answer-sheet-footer">
            <Link to="/features">Explore features</Link>
            <Link to="/about">About the project</Link>
          </footer>
        </div>
      </article>
    </section>
  );
}
