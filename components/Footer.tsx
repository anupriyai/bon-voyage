export default function Footer() {
  return (
    <footer className="site-footer" id="contact">
      <div className="container">
        <div className="footer-grid">
          <div>
            <p className="footer-brand">Bon Voyage</p>
            <p className="footer-blurb">
              Cross-border care coordination for patients and families in underserved regions.
            </p>
          </div>
          <div>
            <h4>Patients</h4>
            <ul>
              <li><a href="#book">Book a consultation</a></li>
              <li><a href="#how-it-works">How it works</a></li>
              <li><a href="#caregivers">For caregivers</a></li>
              <li><a href="#login">Log in</a></li>
            </ul>
          </div>
          <div>
            <h4>Company</h4>
            <ul>
              <li><a href="#providers">For providers</a></li>
              <li><a href="#about">About</a></li>
              <li><a href="#privacy">Privacy</a></li>
              <li><a href="#terms">Terms</a></li>
            </ul>
          </div>
          <div>
            <h4>Contact</h4>
            <ul>
              <li>[EMAIL ADDRESS]</li>
              <li>[PHONE / WHATSAPP]</li>
              <li>
                <a href="#book" className="footer-underline">
                  Send us a message
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="footer-base">
          <span>© 2026 Bon Voyage</span>
          <span>Bon Voyage coordinates care. It does not provide medical advice.</span>
        </div>
      </div>
    </footer>
  );
}
