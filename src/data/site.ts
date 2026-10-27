/**
 * Single source of truth for everything the site says about Mohammed.
 *
 * Content lives here rather than inside components so that updating the site
 * after a new job, certificate or project is a one-file edit.
 *
 * Sourced from the CV (Feb 2026). Paragraphs marked `NEEDS HIS VOICE` are
 * drafts written from the CV — they are accurate, but they should be replaced
 * with Mohammed's own words, because the point of this page is that a person
 * shows up before a skill list does.
 */

export const person = {
  name: "Mohammed Al Abri",
  fullName: "Mohammed Abdul Hamid Mohammed Al Abri",
  location: "Muscat, Oman",
  email: "imohammedalabri@gmail.com",
  github: "https://github.com/6qzr",
  githubHandle: "6qzr",
  linkedin: "https://linkedin.com/in/mohammed-al-abri-434263353",
  cv: "/cv/Mohammed-Al-Abri-CV.pdf",

  /** The line that lands before any job title does. */
  headline: "Curious about how things work.\nCareful about how they last.",

  /**
   * Doubles as the hero lede and the meta description, so it has to state the
   * three things he can be hired for in one breath: building, securing what he
   * builds, and security work in its own right.
   */
  summary:
    "I build backends in .NET, secure what I build, and take on cybersecurity work in its own right. Computer Science graduate, based in Muscat, Oman.",

  roles: ["Full-stack developer", "Cybersecurity"],
} as const;

/** NEEDS HIS VOICE — accurate from the CV, but written by someone else. */
export const about = {
  eyebrow: "Who I am",
  title: "Curious first,\nengineer second.",
  paragraphs: [
    "I am a Computer Science graduate from Sultan Qaboos University, where I specialised in cybersecurity and computing infrastructure. What actually drives me is simpler than that: I want to understand how a thing works all the way down, and I am not satisfied until I do.",
    "That curiosity pulls in two directions at once. One half of me wants to build: to design the data model, get the architecture right, and ship something people rely on. The other half wants to know it will still be standing on a bad day, and to be the reason it is.",
    "I have found those two instincts are the same instinct. Building something well and protecting it are the same care, applied at different moments.",
  ],
  /** Small, human facts. These especially should become his own. */
  facts: [
    { label: "Based in", value: "Muscat, Oman" },
    { label: "Studied at", value: "Sultan Qaboos University" },
    { label: "Currently", value: ".NET team lead at Tamayuz" },
    { label: "Happiest when", value: "A hard problem finally gives way" },
  ],
} as const;

/**
 * The conceptual hook: the two tracks presented as one temperament, so the
 * combination reads as deliberate rather than as two unrelated skill lists.
 */
export const duality = {
  eyebrow: "How the two halves fit",
  title: "Two halves of the same instinct.",
  sides: [
    {
      key: "build",
      label: "Building",
      lede: "Backend systems that hold up under their own weight.",
      body: "Layered ASP.NET Core APIs, relational models designed before a line of code is written, and delivery managed properly: branches, sprints, tracked issues, review. I care about the parts nobody sees: separation of concerns, honest data contracts, migrations that do not ruin someone's afternoon.",
      points: [
        "ASP.NET Core Web API, three-layer architecture",
        "Entity Framework Core and SQL Server",
        "Relational design from ERD to production schema",
        "TypeScript and Angular on the front end",
        "Git-based sprint workflow, as team lead",
      ],
    },
    {
      key: "protect",
      label: "Protecting",
      lede: "The same systems, guarded against the people looking for a way in.",
      body: "A rotation across SOC, application security, GRC and network security at Ooredoo taught me what enterprise defence actually looks like day to day. My graduation project approached it from the other side, building the tooling that finds vulnerabilities early rather than waiting to be told about them.",
      points: [
        "SIEM monitoring and incident response",
        "Nmap, Wireshark, OWASP ZAP, MITRE ATT&CK",
        "Access control, cryptography, secure SDLC",
        "ISC2 Certified in Cybersecurity (CC)",
      ],
    },
  ],
} as const;

/**
 * The full stack, listed under the spiral.
 *
 * `spotlight` marks the ones that ride the golden spiral: one per group, so
 * the spiral mirrors the five headings in the list.
 *
 * Five is a measured limit, not a preference. Arc length on a logarithmic
 * spiral is 3.41x the radius span, so the 536px orbit beside the list offers
 * about 535px of curve. At nine chips that is 59px between them while the
 * chips average 110px wide, which is why they collided. Five gives 107px.
 * Widening the orbit or adding a chip means redoing that arithmetic.
 */
export const stack = [
  { name: "C#", group: "language", spotlight: true },
  { name: "ASP.NET Core", group: "backend", spotlight: true },
  { name: "EF Core", group: "backend", spotlight: false },
  { name: "SQL Server", group: "data", spotlight: true },
  { name: "Python", group: "language", spotlight: false },
  { name: "TypeScript", group: "language", spotlight: false },
  { name: "JavaScript", group: "language", spotlight: false },
  { name: "Java", group: "language", spotlight: false },
  { name: "SQL", group: "data", spotlight: false },
  { name: "Angular", group: "backend", spotlight: false },
  { name: "REST APIs", group: "backend", spotlight: false },
  { name: "JWT Auth", group: "security", spotlight: false },
  { name: "SIEM", group: "security", spotlight: false },
  { name: "Nmap", group: "security", spotlight: true },
  { name: "Wireshark", group: "security", spotlight: false },
  { name: "OWASP ZAP", group: "security", spotlight: false },
  { name: "MITRE ATT&CK", group: "security", spotlight: false },
  { name: "Secure SDLC", group: "security", spotlight: false },
  { name: "Git", group: "devops", spotlight: false },
  { name: "GitHub Actions", group: "devops", spotlight: true },
  { name: "Docker", group: "devops", spotlight: false },
] as const;

export type StackGroup = (typeof stack)[number]["group"];

export const stackGroupLabels: Record<StackGroup, string> = {
  language: "Languages",
  backend: "Web & APIs",
  data: "Data",
  security: "Security",
  devops: "Delivery",
};

/**
 * `track` drives the accent, the same two-colour language the project cards
 * use: green for building, sun for security. The Ooredoo rotation is security
 * work and was rendering in the build colour alongside the two dev roles.
 */
export const timeline = [
  {
    kind: "work",
    track: "build",
    role: "Full Stack .NET Developer & Team Lead",
    org: "Tamayuz Program, Codeline / Rihal Bootcamp",
    place: "Muscat",
    start: "Apr 2026",
    end: "Present",
    points: [
      "Led a team of four, owning architecture, branching strategy and code reviews across 53 tracked issues and two sprints.",
      "Shipped an ASP.NET Core backend with a TypeScript and Bootstrap 5 frontend, then ported it to Angular: 34 components, route guards, unit tests.",
      "Three-layer API (repository, service, controller) on EF Core and SQL Server, with soft deletes and role-based access.",
    ],
  },
  {
    kind: "work",
    track: "build",
    role: "Full Stack Development Intern",
    org: "Rihal & Codeline",
    place: "Muscat",
    start: "Jul 2025",
    end: "Sep 2025",
    points: [
      "Built a Customer Support Ticket System as a team across three Agile sprints, with Git workflows and API integration.",
      "Owned security, role-based access, and the production deployment with data migration.",
    ],
  },
  {
    kind: "work",
    track: "security",
    role: "Information Security Intern",
    org: "Ooredoo",
    place: "Muscat",
    start: "Jun 2024",
    end: "Aug 2024",
    points: [
      "Rotated across SOC, application security, GRC and network security teams.",
      "Supported SIEM-based monitoring and incident response, and contributed to DLP compliance audits.",
      "Worked hands-on with firewalls, privileged access management, VPNs and secure SDLC practices.",
    ],
  },
  {
    kind: "education",
    track: "study",
    role: "BSc Computer Science",
    org: "Sultan Qaboos University",
    place: "Oman",
    start: "Sep 2020",
    end: "Feb 2026",
    points: [
      "Specialised in cybersecurity and computing infrastructure. GPA 3.56.",
      "Dean's List 2021–2024, for honours and distinction across multiple terms.",
      "Member of the College of Science Student Society, 2024 to 2025.",
      "Worked on campus through the university's student employment scheme, and earlier as a teaching assistant.",
    ],
  },
] as const;

export const certificates = [
  { name: "Certified in Cybersecurity (CC)", issuer: "ISC2", url: null },
  {
    name: "Metasploit for Beginners",
    issuer: "Coursera",
    url: "https://coursera.org/share/91f2565f30427ee929ba1b5d53eed6b9",
  },
  {
    name: "Wireshark for Packet Capture",
    issuer: "Coursera",
    url: "https://coursera.org/share/d7e51c43d9a7dbc165e52f1292c92c7b",
  },
  {
    name: "Introduction to AI Tools and Productivity",
    issuer: "Ministry of Labour",
    url: null,
  },
] as const;

/*
 * Absolute, not bare fragments. A bare `#about` does nothing on a project
 * page, because that section only exists on the home page, so every nav link
 * was dead once you left it.
 */
export const nav = [
  { label: "About", href: "/#about" },
  { label: "Craft", href: "/#craft" },
  { label: "Work", href: "/#work" },
  { label: "Path", href: "/#path" },
  { label: "Contact", href: "/#contact" },
] as const;
