import { useState, useEffect } from 'react'
import mrduOfficialLogo from '../assets/branding/mrdu-official-logo.png'
import mrduBanner from '../assets/branding/mrdu-header-banner.png'
import './MrduOfficialLanding.css'

export default function MrduOfficialLanding({ onOpenAuth, onOpenRegister, events = [] }) {
  const [activeTab, setActiveTab] = useState('upcoming')
  const [announcementCount] = useState(10)
  const [showCookie, setShowCookie] = useState(true)

  // University announcements
  const announcements = [
    { dateNum: '11', dateMonth: 'JUL', title: 'B.Sc and B.Com Courses — Application Guidelines 2026-27' },
    { dateNum: '07', dateMonth: 'JUL', title: 'Exam Fee Notification for M.Tech and MBA Sem-II (MR25) ~ July 2026' },
    { dateNum: '28', dateMonth: 'JUN', title: 'University Academic Calendar 2026-27 Released for Engineering & Sciences' },
    { dateNum: '22', dateMonth: 'MAY', title: 'Admissions Open 2026-27: Apply Online for UG & PG Professional Programmes' },
  ]

  // Default / Featured Events
  const displayEvents = events.length > 0 ? events.slice(0, 3) : [
    {
      id: 'evt-1',
      title: '21st Graduation , Placement and Alumni Day',
      date: '25th July 2026',
      type: 'Ceremony',
      image: 'https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=800&q=80',
    },
    {
      id: 'evt-2',
      title: 'Hands-On Workshop IEEE Formatting Masterclass using Overleaf and Microsoft Word',
      date: '18th July 2026',
      type: 'Workshop',
      image: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=800&q=80',
    },
    {
      id: 'evt-3',
      title: 'INAUGURATION OF AGENTIC CLUB by Department of CSE-AIML',
      date: '18th July 2026',
      type: 'Inauguration',
      image: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80',
    },
  ]

  // Campus Life 8 Photo Tiles
  const campusTiles = [
    { title: 'Transport', tag: 'UNIVERSITY FLEET', img: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1200&q=80', large: true },
    { title: 'Library', tag: 'KNOWLEDGE HUB', img: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=800&q=80' },
    { title: 'Computer Lab', tag: 'HIGH-TECH LABS', img: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&q=80' },
    { title: 'Hostels', tag: 'CAMPUS LIVING', img: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=800&q=80' },
    { title: 'Cafeteria', tag: 'STUDENT DINING', img: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80' },
    { title: 'Sports', tag: 'ATHLETIC GROUNDS', img: 'https://images.unsplash.com/photo-1526676037777-05a232554f77?auto=format&fit=crop&w=800&q=80' },
    { title: 'Auditorium', tag: 'CONVENTION CENTER', img: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=800&q=80' },
    { title: 'Arts & Culture', tag: 'CAMPUS LIFE', img: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=800&q=80' },
  ]

  return (
    <div className="mrdu-portal">
      {/* ----------------------------------------------------
          1. Utility Top Bar (Deep Navy)
          ---------------------------------------------------- */}
      <div className="mrdu-topbar">
        <div className="mrdu-topbar-inner">
          <div className="mrdu-topbar-links">
            <a href="#home" className="mrdu-topbar-link">HOME</a>
            <a href="#about" className="mrdu-topbar-link">ABOUT US</a>
            <a href="#placements" className="mrdu-topbar-link">PLACEMENTS</a>
            <a href="#alumni" className="mrdu-topbar-link">ALUMNI</a>
            <a href="#contact" className="mrdu-topbar-link">CONTACT</a>
            <a href="#brochure" className="mrdu-topbar-link">BROCHURE</a>
            <a href="#faqs" className="mrdu-topbar-link">FAQS</a>
          </div>

          <div className="mrdu-topbar-actions">
            <button className="mrdu-btn-apply-now" onClick={onOpenRegister}>
              APPLY NOW ➔
            </button>
            <div className="mrdu-social-icons">
              <a href="https://whatsapp.com" target="_blank" rel="noreferrer" className="mrdu-social-link" title="WhatsApp">💬</a>
              <a href="https://facebook.com" target="_blank" rel="noreferrer" className="mrdu-social-link" title="Facebook">f</a>
              <a href="https://twitter.com" target="_blank" rel="noreferrer" className="mrdu-social-link" title="X (Twitter)">𝕏</a>
              <a href="https://linkedin.com" target="_blank" rel="noreferrer" className="mrdu-social-link" title="LinkedIn">in</a>
              <a href="https://instagram.com" target="_blank" rel="noreferrer" className="mrdu-social-link" title="Instagram">📸</a>
              <a href="https://youtube.com" target="_blank" rel="noreferrer" className="mrdu-social-link" title="YouTube">▶</a>
            </div>
            <div className="mrdu-search-bar">
              <input type="text" placeholder="Search..." className="mrdu-search-input" />
              <button className="mrdu-search-btn" title="Search">🔍</button>
            </div>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------
          2. Main Header / Navigation Bar (White & Clean)
          ---------------------------------------------------- */}
      <header className="mrdu-header">
        <div className="mrdu-header-inner">
          <div className="mrdu-brand-group" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <img
              src={mrduOfficialLogo}
              alt="Malla Reddy (MR) Deemed to be University"
              className="mrdu-brand-logo"
            />
            <div className="mrdu-brand-titles">
              <span className="mrdu-brand-uni">Malla Reddy (MR)</span>
              <span className="mrdu-brand-sub">DEEMED TO BE UNIVERSITY</span>
            </div>
            <div className="mrdu-brand-badges">
              <div className="mrdu-nirf-badge">
                <strong>nirf</strong>
                <span>RANK 101-150</span>
              </div>
              <span className="mrdu-acc-pill" style={{ background: '#f8fafc', color: '#b91c1c', borderColor: '#fca5a5' }}>
                NAAC A++
              </span>
            </div>
          </div>

          <nav>
            <ul className="mrdu-nav-links">
              <li className="mrdu-nav-item"><a href="#governance" className="mrdu-nav-link">Governance</a></li>
              <li className="mrdu-nav-item"><a href="#accreditations" className="mrdu-nav-link">Accreditations</a></li>
              <li className="mrdu-nav-item"><a href="#academics" className="mrdu-nav-link">Academics</a></li>
              <li className="mrdu-nav-item"><a href="#admissions" className="mrdu-nav-link">Admissions</a></li>
              <li className="mrdu-nav-item"><a href="#resources" className="mrdu-nav-link">Resources</a></li>
              <li className="mrdu-nav-item"><a href="#research" className="mrdu-nav-link">Research</a></li>
              <li className="mrdu-nav-item"><a href="#examinations" className="mrdu-nav-link">Examinations</a></li>
              <li className="mrdu-nav-item"><a href="#campus-life" className="mrdu-nav-link">Life@MRDU</a></li>
              <li className="mrdu-nav-item"><a href="#campuses" className="mrdu-nav-link">Campuses</a></li>
            </ul>
          </nav>

          <button className="mrdu-header-auth-btn" onClick={onOpenAuth}>
            <span>🔒</span> PORTAL SIGN IN
          </button>
        </div>
      </header>

      {/* ----------------------------------------------------
          3. Notification Marquee Bar (Vibrant Orange)
          ---------------------------------------------------- */}
      <div className="mrdu-ticker-bar">
        <div className="mrdu-ticker-tag">
          <span>🔔</span> Latest Notifications
        </div>
        <div className="mrdu-ticker-content">
          <span className="mrdu-ticker-text">
            📢 Admissions Open for 2026-27 Academic Year across B.Tech, M.Tech, MBA & B.Sc Programmes &nbsp;&nbsp;·&nbsp;&nbsp;
            🎓 21st Graduation & Placement Day Scheduled &nbsp;&nbsp;·&nbsp;&nbsp;
            🏆 National Level Technical Symposium & Hackathons Registration Live &nbsp;&nbsp;·&nbsp;&nbsp;
            ⚡ University NAAC A++ Accredited with 24+ Years of Technical Leadership
          </span>
        </div>
      </div>

      {/* ----------------------------------------------------
          4. Hero Section ("Shape Your Future")
          ---------------------------------------------------- */}
      <section className="mrdu-hero" id="home">
        <div className="mrdu-hero-inner">
          <div className="mrdu-hero-text">
            <div className="mrdu-accreditation-row">
              <span className="mrdu-acc-pill">NAAC A++</span>
              <span className="mrdu-acc-pill">UGC SECTION 3</span>
              <span className="mrdu-acc-pill">NBA TIER-1</span>
            </div>

            <p className="mrdu-hero-eyebrow">
              <span>★</span> INDUSTRY-FOCUSED HIGHER EDUCATION
            </p>

            <h1 className="mrdu-hero-title">
              Shape Your Future
            </h1>

            <p className="mrdu-hero-desc">
              Malla Reddy (MR) Deemed to be University — a premier institution with over 24 years of academic excellence. Undergraduate and postgraduate programmes built for innovation, research, and global careers.
            </p>

            <div className="mrdu-hero-buttons">
              <button className="mrdu-btn-hero-primary" onClick={onOpenRegister}>
                Apply Now ➔
              </button>
              <button className="mrdu-btn-hero-secondary" onClick={() => {
                document.getElementById('academics')?.scrollIntoView({ behavior: 'smooth' })
              }}>
                Explore Programmes
              </button>
              <button className="mrdu-btn-hero-secondary" style={{ borderColor: 'var(--mrdu-orange)', color: '#fed7aa' }} onClick={onOpenAuth}>
                Events & Member Portal 🔒
              </button>
            </div>
          </div>

          <div className="mrdu-hero-visual">
            <div className="mrdu-hero-image-card">
              <img
                src="https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=1200&q=80"
                alt="MRDU University Campus Life & Students"
                className="mrdu-hero-img"
              />
              <div className="mrdu-hero-float-badge">
                <div className="mrdu-float-badge-icon">🎓</div>
                <div className="mrdu-float-badge-text">
                  <strong>24+ Years Excellence</strong>
                  <span>NAAC A++ · Deemed to be University</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------
          5. "Why Choose Us?" Section
          ---------------------------------------------------- */}
      <section className="mrdu-why-section" id="about">
        <div className="mrdu-why-container">
          <div className="mrdu-section-header">
            <span className="mrdu-section-tag">— WHY CHOOSE US? —</span>
            <h2 className="mrdu-section-title">Academic Excellence & Future-Ready Learning</h2>
            <p className="mrdu-section-subtitle">
              Academic excellence, innovation, and industry relevance that prepare graduates for global careers.
            </p>
          </div>

          <div className="mrdu-why-grid">
            <div className="mrdu-why-card">
              <div className="mrdu-why-icon-box">📖</div>
              <div className="mrdu-why-content">
                <h3>Future-Ready Curriculum</h3>
                <p>Syllabus continuously updated with industry feedback, emerging technologies, and hands-on laboratory tracks.</p>
              </div>
            </div>

            <div className="mrdu-why-card">
              <div className="mrdu-why-icon-box">🏢</div>
              <div className="mrdu-why-content">
                <h3>Modern Learning Facilities</h3>
                <p>Smart air-conditioned classrooms, state-of-the-art computer labs, spacious modern hostels, and multi-sport complexes.</p>
              </div>
            </div>

            <div className="mrdu-why-card">
              <div className="mrdu-why-icon-box">🔬</div>
              <div className="mrdu-why-content">
                <h3>Research & Innovation Focus</h3>
                <p>UGC-recognized R&D Centres, 4-Star IIC ranking, innovation patents, and an active incubator ecosystem.</p>
              </div>
            </div>

            <div className="mrdu-why-card">
              <div className="mrdu-why-icon-box">🏅</div>
              <div className="mrdu-why-content">
                <h3>Academic Excellence</h3>
                <p>24+ years of quality technical education with prestigious NAAC A++ accreditation and NBA Tier-1 standards.</p>
              </div>
            </div>

            <div className="mrdu-why-card">
              <div className="mrdu-why-icon-box">🌐</div>
              <div className="mrdu-why-content">
                <h3>Global Recognition</h3>
                <p>Consistent top NIRF rankings across Engineering, Institutional, and allied multidisciplinary departments.</p>
              </div>
            </div>

            <div className="mrdu-why-card">
              <div className="mrdu-why-icon-box">🤝</div>
              <div className="mrdu-why-content">
                <h3>Industry Partnerships</h3>
                <p>Strong tie-ups with leading Fortune 500 recruiters and industry-aligned experiential skill certifications.</p>
              </div>
            </div>

            <div className="mrdu-why-card">
              <div className="mrdu-why-icon-box">🌿</div>
              <div className="mrdu-why-content">
                <h3>Vibrant Campus</h3>
                <p>Sprawling lush green infrastructure, active student technical societies, annual cultural fests, and sports clubs.</p>
              </div>
            </div>

            <div className="mrdu-why-card">
              <div className="mrdu-why-icon-box">💻</div>
              <div className="mrdu-why-content">
                <h3>Advanced Cyber & Tech Labs</h3>
                <p>High-performance computing clusters, ethical hacking sandboxes, SOC defense facilities, and AI/ML workspaces.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------
          6. Campus Updates & Latest Announcements
          ---------------------------------------------------- */}
      <section className="mrdu-updates-section" id="updates">
        <div className="mrdu-updates-container">
          {/* Left Action Card */}
          <div className="mrdu-updates-left-card">
            <div>
              <span className="mrdu-section-tag" style={{ color: '#fed7aa' }}>STAY UPDATED</span>
              <h2>Campus Updates</h2>
              <p>Stay informed with the latest university announcements, events, placements, and examination schedules.</p>
            </div>

            <div className="mrdu-quick-action-tiles">
              <div className="mrdu-quick-tile" onClick={() => document.getElementById('notices')?.scrollIntoView({ behavior: 'smooth' })}>
                <div className="mrdu-quick-tile-text">
                  <strong>Announcements</strong>
                  <span>University notices & circulars</span>
                </div>
                <span>➔</span>
              </div>

              <div className="mrdu-quick-tile" onClick={() => document.getElementById('events-section')?.scrollIntoView({ behavior: 'smooth' })}>
                <div className="mrdu-quick-tile-text">
                  <strong>Events</strong>
                  <span>Campus activities & symposiums</span>
                </div>
                <span>➔</span>
              </div>

              <div className="mrdu-quick-tile" onClick={() => document.getElementById('placements')?.scrollIntoView({ behavior: 'smooth' })}>
                <div className="mrdu-quick-tile-text">
                  <strong>Placements</strong>
                  <span>Career opportunities & top packages</span>
                </div>
                <span>➔</span>
              </div>

              <div className="mrdu-quick-tile" onClick={onOpenAuth}>
                <div className="mrdu-quick-tile-text">
                  <strong>Examinations</strong>
                  <span>Schedules, fee notifications & results</span>
                </div>
                <span>➔</span>
              </div>
            </div>
          </div>

          {/* Right Announcements Card */}
          <div className="mrdu-updates-right-card" id="notices">
            <div>
              <div className="mrdu-notices-header">
                <div>
                  <span className="mrdu-section-tag">UNIVERSITY NOTICES</span>
                  <h3>Latest Announcements</h3>
                </div>
                <span className="mrdu-notices-count-badge">📢 {announcementCount} Updates</span>
              </div>

              <div className="mrdu-notice-list">
                {announcements.map((item, idx) => (
                  <div key={idx} className="mrdu-notice-item" onClick={onOpenAuth}>
                    <div className="mrdu-date-badge">
                      <span className="mrdu-date-num">{item.dateNum}</span>
                      <span className="mrdu-date-month">{item.dateMonth}</span>
                    </div>
                    <span className="mrdu-notice-title">{item.title}</span>
                    <span className="mrdu-notice-arrow">➔</span>
                  </div>
                ))}
              </div>
            </div>

            <button className="mrdu-btn-view-notices" onClick={onOpenAuth}>
              View All Notifications ➔
            </button>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------
          7. "Our Schools" (Academics)
          ---------------------------------------------------- */}
      <section className="mrdu-schools-section" id="academics">
        <div className="mrdu-schools-container">
          <div className="mrdu-section-header">
            <span className="mrdu-section-tag">— ACADEMICS —</span>
            <h2 className="mrdu-section-title">Our Schools</h2>
            <p className="mrdu-section-subtitle">
              Industry-oriented programmes across schools of engineering, management, and allied disciplines at Malla Reddy Deemed to be University.
            </p>
          </div>

          <div className="mrdu-schools-grid">
            <div className="mrdu-school-card">
              <div className="mrdu-school-banner mrdu-school-banner-orange" />
              <div className="mrdu-school-body">
                <div>
                  <h3>Electronics and Electrical Engineering</h3>
                  <p>Electronic systems, communication technology, VLSI design, semiconductor engineering, and power grid automation.</p>
                </div>
                <a href="#academics" className="mrdu-school-link" onClick={onOpenRegister}>Explore school ➔</a>
              </div>
            </div>

            <div className="mrdu-school-card">
              <div className="mrdu-school-banner mrdu-school-banner-blue" />
              <div className="mrdu-school-body">
                <div>
                  <h3>Civil and Mechanical Engineering</h3>
                  <p>Sustainable infrastructure design, robotics, advanced CAD/CAM manufacturing, automotive engineering, and aerospace systems.</p>
                </div>
                <a href="#academics" className="mrdu-school-link" onClick={onOpenRegister}>Explore school ➔</a>
              </div>
            </div>

            <div className="mrdu-school-card">
              <div className="mrdu-school-banner mrdu-school-banner-coral" />
              <div className="mrdu-school-body">
                <div>
                  <h3>Management and Technology</h3>
                  <p>Business analytics, strategy, entrepreneurship, fintech management, and digital enterprise software architectures.</p>
                </div>
                <a href="#academics" className="mrdu-school-link" onClick={onOpenRegister}>Explore school ➔</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------
          8. Events & Video Gallery
          ---------------------------------------------------- */}
      <section className="mrdu-events-section" id="events-section">
        <div className="mrdu-events-container">
          <div className="mrdu-section-header">
            <span className="mrdu-section-tag">— CAMPUS EVENTS —</span>
            <h2 className="mrdu-section-title">University Events & Conferences</h2>
            <p className="mrdu-section-subtitle">
              Participate in grand university symposiums, technical hackathons, guest lectures, and student festivals.
            </p>
          </div>

          <div className="mrdu-events-tabs-row">
            <div className="mrdu-events-tabs">
              <button
                className={`mrdu-tab-btn ${activeTab === 'upcoming' ? 'active' : ''}`}
                onClick={() => setActiveTab('upcoming')}
              >
                Upcoming Events
              </button>
              <button
                className={`mrdu-tab-btn ${activeTab === 'concluded' ? 'active' : ''}`}
                onClick={() => setActiveTab('concluded')}
              >
                Concluded Events
              </button>
            </div>

            <button className="mrdu-btn-view-all-events" onClick={onOpenAuth}>
              View All Events ➔
            </button>
          </div>

          {/* Event Cards Grid */}
          <div className="mrdu-events-grid">
            {displayEvents.map((evt, idx) => (
              <div key={idx} className="mrdu-event-card">
                <div className="mrdu-event-img-wrap">
                  <img
                    src={evt.image || evt.photoUrl || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=800&q=80'}
                    alt={evt.title}
                    className="mrdu-event-img"
                  />
                  <span className="mrdu-event-date-pill">{evt.date || (evt.dateTime ? new Date(evt.dateTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '2026')}</span>
                </div>
                <div className="mrdu-event-body">
                  <h4>{evt.title}</h4>
                  <button className="mrdu-event-btn" onClick={onOpenAuth} style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}>
                    View Details & Register ➔
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Video Gallery Row */}
          <div className="mrdu-section-header" style={{ marginBottom: '32px' }}>
            <span className="mrdu-section-tag">— CAMPUS LIFE REELS —</span>
            <h2 className="mrdu-section-title" style={{ fontSize: '26px' }}>Events & Video Gallery</h2>
          </div>

          <div className="mrdu-video-gallery-row">
            <div className="mrdu-video-card" onClick={onOpenAuth}>
              <img src="https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=600&q=80" alt="MRDU Annual Fest" className="mrdu-video-img" />
              <div className="mrdu-video-overlay">
                <span className="mrdu-acc-pill" style={{ width: 'fit-content', background: 'rgba(0,0,0,0.5)' }}>CAMPUS FEST</span>
                <div className="mrdu-video-play-icon">▶</div>
                <p className="mrdu-video-title">Annual University Fest & Cultural Highlights</p>
              </div>
            </div>

            <div className="mrdu-video-card" onClick={onOpenAuth}>
              <img src="https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=600&q=80" alt="Cyber CTF & Tech Symposium" className="mrdu-video-img" />
              <div className="mrdu-video-overlay">
                <span className="mrdu-acc-pill" style={{ width: 'fit-content', background: 'rgba(0,0,0,0.5)' }}>TECH SYMPOSIUM</span>
                <div className="mrdu-video-play-icon">▶</div>
                <p className="mrdu-video-title">National Cyber CTF & Robotics Arena</p>
              </div>
            </div>

            <div className="mrdu-video-card" onClick={onOpenAuth}>
              <img src="https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=600&q=80" alt="Convocation Day" className="mrdu-video-img" />
              <div className="mrdu-video-overlay">
                <span className="mrdu-acc-pill" style={{ width: 'fit-content', background: 'rgba(0,0,0,0.5)' }}>CONVOCATION</span>
                <div className="mrdu-video-play-icon">▶</div>
                <p className="mrdu-video-title">21st Graduation Ceremony & Gold Medalists</p>
              </div>
            </div>

            <div className="mrdu-video-card" onClick={onOpenAuth}>
              <img src="https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=600&q=80" alt="AI Agentic Club" className="mrdu-video-img" />
              <div className="mrdu-video-overlay">
                <span className="mrdu-acc-pill" style={{ width: 'fit-content', background: 'rgba(0,0,0,0.5)' }}>INNOVATION</span>
                <div className="mrdu-video-play-icon">▶</div>
                <p className="mrdu-video-title">Inauguration of Department Technical Clubs</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------
          9. Where Our Graduates Work & Crimson Stat Banner
          ---------------------------------------------------- */}
      <section className="mrdu-placements-section" id="placements">
        <div className="mrdu-placements-container">
          <div className="mrdu-placement-highlights-row">
            <div>
              <span className="mrdu-section-tag">— PLACEMENTS —</span>
              <h2 className="mrdu-section-title" style={{ textAlign: 'left', margin: '4px 0 10px' }}>
                Where Our Graduates Work
              </h2>
              <p className="mrdu-section-subtitle" style={{ textAlign: 'left', maxWidth: '640px' }}>
                From campus to career, MRDU graduates connect with leading organisations across IT, consulting, banking, core engineering, and emerging industries.
              </p>
            </div>

            <div className="mrdu-placement-stats-pills">
              <div className="mrdu-stat-pill">
                <strong>24 LPA</strong>
                <span>Highest Package</span>
              </div>
              <div className="mrdu-stat-pill">
                <strong>6.2 LPA</strong>
                <span>Average Package</span>
              </div>
              <div className="mrdu-stat-pill">
                <strong>800+</strong>
                <span>Placement Offers</span>
              </div>
            </div>
          </div>

          {/* Deep Crimson Stat Banner */}
          <div className="mrdu-crimson-banner">
            <div className="mrdu-crimson-stats-row">
              <div className="mrdu-crimson-stat-item">
                <strong>800+</strong>
                <h4>Placement Offers</h4>
                <p>Career opportunities created through our career placement ecosystem</p>
              </div>

              <div className="mrdu-crimson-stat-item">
                <strong>50+</strong>
                <h4>Recruiting Partners</h4>
                <p>Global Fortune 500 enterprises hiring talent across multiple domains</p>
              </div>

              <div className="mrdu-crimson-stat-item">
                <strong>24 LPA</strong>
                <h4>Highest Package</h4>
                <p>Rewarding top student innovators with career-defining corporate roles</p>
              </div>
            </div>

            <h3 className="mrdu-crimson-slogan">
              “From Expectations to Experiences”
            </h3>
          </div>

          {/* Recruiter Logos / Chips */}
          <div className="mrdu-recruiters-grid">
            {['TATA CONSULTANCY SERVICES', 'INFOSYS', 'AMAZON', 'CAPGEMINI', 'COGNIZANT', 'WIPRO', 'ACCENTURE', 'MICROSOFT', 'ORACLE', 'DELL TECHNOLOGIES'].map((recruiter, idx) => (
              <span key={idx} className="mrdu-recruiter-chip">
                {recruiter}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------
          10. Message from Our Leaders
          ---------------------------------------------------- */}
      <section className="mrdu-leadership-section" id="leadership">
        <div className="mrdu-leadership-container">
          <div className="mrdu-section-header">
            <span className="mrdu-section-tag">— LEADERSHIP —</span>
            <h2 className="mrdu-section-title">Message from Our Leaders</h2>
          </div>

          <div className="mrdu-leader-card">
            <div className="mrdu-leader-photo-wrap">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80"
                alt="Prof. Mandala Sreenivas"
                className="mrdu-leader-avatar"
              />
              <h4>PROF. MANDALA SREENIVAS</h4>
              <span>REGISTRAR · MRDU</span>
            </div>

            <div className="mrdu-leader-content">
              <h3>From the Registrar's Desk</h3>
              <blockquote>
                “Ensuring transparency, efficiency, and integrity across all academic and administrative processes is at the heart of our mission. From admissions to university governance and technical societies, we strive to create a seamless, world-class ecosystem for every student.”
              </blockquote>
              <button className="mrdu-leader-btn" onClick={onOpenAuth}>
                Read More ➔
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------
          11. Campus Life (8-Photo Interactive Grid)
          ---------------------------------------------------- */}
      <section className="mrdu-campus-life-section" id="campus-life">
        <div className="mrdu-campus-life-container">
          <div className="mrdu-section-header">
            <span className="mrdu-section-tag">— LIFE AT MRDU —</span>
            <h2 className="mrdu-section-title">Campus Life</h2>
            <p className="mrdu-section-subtitle">
              Discover the experiences, spaces, and moments that make life at MRDU vibrant and memorable.
            </p>
          </div>

          <div className="mrdu-campus-grid">
            {campusTiles.map((tile, idx) => (
              <div
                key={idx}
                className={`mrdu-campus-tile ${tile.large ? 'mrdu-campus-tile-large' : ''}`}
                onClick={onOpenAuth}
              >
                <img src={tile.img} alt={tile.title} className="mrdu-campus-img" />
                <div className="mrdu-campus-overlay">
                  <span>{tile.tag}</span>
                  <h4>{tile.title}</h4>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------
          12. Official MRDU Footer (Deep Navy)
          ---------------------------------------------------- */}
      <footer className="mrdu-footer" id="contact">
        <div className="mrdu-footer-inner">
          {/* Column 1: Brand & Contact */}
          <div className="mrdu-footer-col">
            <img src={mrduOfficialLogo} alt="MRDU Logo" className="mrdu-footer-brand-logo" />
            <h4 style={{ border: 'none', padding: 0, margin: '0 0 10px 0', fontSize: '15px' }}>
              Malla Reddy (MR) Deemed to be University
            </h4>
            <p className="mrdu-footer-address">
              Maisammaguda(H), Gundlapochampally Village, Medchal Mandal, Medchal-Malkajgiri District, Telangana State - 500100
            </p>
            <div className="mrdu-footer-contact-item">
              <strong>Phone:</strong> 8712020867 / 68 / 69
            </div>
            <div className="mrdu-footer-contact-item">
              <strong>Cell:</strong> 9348161303
            </div>
            <div className="mrdu-footer-contact-item">
              <strong>Email:</strong> info@mrdu.edu.in
            </div>
            <div className="mrdu-social-icons" style={{ marginTop: '16px' }}>
              <a href="https://facebook.com" target="_blank" rel="noreferrer" className="mrdu-social-link">f</a>
              <a href="https://twitter.com" target="_blank" rel="noreferrer" className="mrdu-social-link">𝕏</a>
              <a href="https://linkedin.com" target="_blank" rel="noreferrer" className="mrdu-social-link">in</a>
              <a href="https://instagram.com" target="_blank" rel="noreferrer" className="mrdu-social-link">📸</a>
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div className="mrdu-footer-col">
            <h4>QUICK LINKS</h4>
            <ul className="mrdu-footer-links-list">
              <li><a href="#home" className="mrdu-footer-link">Home</a></li>
              <li><a href="#about" className="mrdu-footer-link">About Us</a></li>
              <li><a href="#academics" className="mrdu-footer-link">Administration</a></li>
              <li><a href="#academics" className="mrdu-footer-link">Academics</a></li>
              <li><a href="#admissions" className="mrdu-footer-link" onClick={onOpenRegister}>Admissions</a></li>
              <li><a href="#campus-life" className="mrdu-footer-link">Student Life</a></li>
              <li><a href="#research" className="mrdu-footer-link">Research</a></li>
              <li><a href="#nirf" className="mrdu-footer-link">NIRF & Rankings</a></li>
              <li><a href="#naac" className="mrdu-footer-link">NAAC Accreditation</a></li>
              <li><a href="#aicte" className="mrdu-footer-link">AICTE Disclosures</a></li>
            </ul>
          </div>

          {/* Column 3: Useful Links */}
          <div className="mrdu-footer-col">
            <h4>USEFUL LINKS</h4>
            <ul className="mrdu-footer-links-list">
              <li><a href="#grc" className="mrdu-footer-link" onClick={onOpenAuth}>Grievance Redressal (GRC)</a></li>
              <li><a href="#sgrc" className="mrdu-footer-link" onClick={onOpenAuth}>Student Grievance Redressal (SGRC)</a></li>
              <li><a href="#arc" className="mrdu-footer-link">Anti-Ragging Committee (ARC)</a></li>
              <li><a href="#ic" className="mrdu-footer-link">Internal Committee (IC)</a></li>
              <li><a href="#scst" className="mrdu-footer-link">SC/ST Committee</a></li>
              <li><a href="#ombudsperson" className="mrdu-footer-link">Ombudsperson</a></li>
              <li><a href="#virtual-tour" className="mrdu-footer-link">Virtual Tour</a></li>
              <li><a href="#privacy" className="mrdu-footer-link">Privacy Policy</a></li>
              <li><a href="#tirupati" className="mrdu-footer-link">Off Campus - Tirupati</a></li>
            </ul>
          </div>

          {/* Column 4: Our Campus Map */}
          <div className="mrdu-footer-col">
            <h4>OUR CAMPUS</h4>
            <div className="mrdu-map-card">
              <p><strong>Hyderabad Main Campus:</strong><br />Maisammaguda, Medchal-Malkajgiri, Telangana 500100</p>
              <a
                href="https://maps.google.com/?q=Malla+Reddy+University+Maisammaguda"
                target="_blank"
                rel="noreferrer"
                className="mrdu-map-link"
              >
                🗺️ Open in Google Maps ➔
              </a>
            </div>
            <button
              className="mrdu-btn-hero-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '10px 16px', fontSize: '11px' }}
              onClick={onOpenAuth}
            >
              Sign in to Event Portal ➔
            </button>
          </div>
        </div>

        {/* Footer Bottom */}
        <div className="mrdu-footer-bottom">
          <span>© 2026 Malla Reddy (MR) Deemed to be University. All Rights Reserved.</span>
          <span>Designed with Precision for Higher Education Excellence</span>
        </div>
      </footer>

      {/* Cookie Banner */}
      {showCookie && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#07162c',
          borderTop: '1px solid rgba(255, 255, 255, 0.15)',
          padding: '12px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 999,
          color: '#cbd5e1',
          fontSize: '12px',
          flexWrap: 'wrap',
          gap: '12px',
        }}>
          <span>We use cookies to improve your experience and track event registrations. <a href="#privacy" style={{ color: 'var(--mrdu-orange)' }}>Learn more</a></span>
          <button
            onClick={() => setShowCookie(false)}
            style={{
              background: 'var(--mrdu-orange)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 18px',
              fontWeight: 700,
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            ACCEPT
          </button>
        </div>
      )}
    </div>
  )
}
