import { Globe } from 'lucide-react';
import { Github, Linkedin } from './SocialIcons';

const developerLinks = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/bishal-bhandari-a63b8926a', icon: Linkedin },
  { label: 'Portfolio', href: 'https://bhandari-bishal.com.np', icon: Globe },
  { label: 'GitHub', href: 'https://github.com/4Bishal', icon: Github },
];

export default function Footer({ children }) {
  return <footer className="platform-footer">
      <p className="footer-developer-credit">Designed &amp; Engineered with <span role="img" aria-label="love">❤️</span> by <strong>Bishal Bhandari</strong></p>
      <nav className="footer-developer-links" aria-label="Developer social and portfolio links">
        {developerLinks.map(({ label, href, icon: Icon }) => <a key={label} className="footer-social-pill" href={href} target="_blank" rel="noopener noreferrer">
          <Icon size={16} aria-hidden="true"/>
          <span>{label}</span><span className="sr-only"> (opens in a new tab)</span>
        </a>)}
      </nav>
    {children}
  </footer>;
}
