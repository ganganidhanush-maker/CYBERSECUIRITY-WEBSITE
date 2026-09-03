import React, { Component, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import clubLogo from './assets/branding/cyber-security-club-neon.jpg'
import clubLogoDark from './assets/branding/cyber-security-club-logo.jpg'
import mrduBanner from './assets/branding/mrdu-header-banner.png'
import mrduOfficialLogo from './assets/branding/mrdu-official-logo.png'
import MrduOfficialLanding from './components/MrduOfficialLanding'
import { adminApi, authApi, memberApi, readImageFile, readMultipleImageFiles } from './lib/api'
import { downloadIdPass } from './lib/id-pass'
import { downloadCsv } from './lib/export-csv'
import { getYouTubeEmbedUrl, parseYouTubeVideoId } from './lib/video'
import jsQR from 'jsqr'
import './App.css'

/* oxlint-disable no-unused-vars */

export const PlatformThemeContext = createContext({
  platformMode: 'CYBER_SECURITY_CLUB',
  setPlatformMode: () => {},
  themeMode: 'system',
  setThemeMode: () => {},
  resolvedTheme: 'light',
  clubSettings: null,
  setClubSettings: () => {},
  reelsEnabled: true,
  subEnabled: false,
  onSwitchPersonaRole: () => {},
  onSwitchAccount: async () => {},
  onSwitchBackToAdmin: async () => {},
})

export function usePlatformTheme() {
  return useContext(PlatformThemeContext)
}

const ROLE_PERMISSIONS_MAP = {
  STUDENT_COORDINATOR: [
    'ACCOUNT_MANAGEMENT', 'DASHBOARD_VIEW', 'EVENTS_VIEW', 'EVENT_MANAGE', 'EVENT_REGISTER',
    'REGISTRATIONS_VIEW', 'PAYMENTS_VIEW', 'PAYMENTS_VERIFY', 'QR_PASSES_VIEW', 'GALLERY_VIEW',
    'GALLERY_MANAGE', 'REELS_MANAGE', 'TEAM_MANAGE', 'SETTINGS_MANAGE', 'AUDIT_VIEW',
    'CHAT_USE', 'SUGGESTIONS_CREATE', 'FEEDBACK_CREATE', 'NOTIFICATIONS_VIEW', 'PROFILE_EDIT',
  ],
  PRESIDENT: [
    'ACCOUNT_MANAGEMENT', 'DASHBOARD_VIEW', 'EVENTS_VIEW', 'EVENT_MANAGE', 'EVENT_REGISTER',
    'REGISTRATIONS_VIEW', 'PAYMENTS_VIEW', 'PAYMENTS_VERIFY', 'QR_PASSES_VIEW', 'GALLERY_VIEW',
    'GALLERY_MANAGE', 'REELS_MANAGE', 'TEAM_MANAGE', 'SETTINGS_MANAGE', 'AUDIT_VIEW',
    'CHAT_USE', 'SUGGESTIONS_CREATE', 'FEEDBACK_CREATE', 'NOTIFICATIONS_VIEW', 'PROFILE_EDIT',
  ],
  VICE_PRESIDENT: [
    'ACCOUNT_MANAGEMENT', 'DASHBOARD_VIEW', 'EVENTS_VIEW', 'EVENT_MANAGE', 'EVENT_REGISTER',
    'REGISTRATIONS_VIEW', 'PAYMENTS_VIEW', 'QR_PASSES_VIEW', 'GALLERY_VIEW', 'GALLERY_MANAGE',
    'REELS_MANAGE', 'TEAM_MANAGE', 'CHAT_USE', 'NOTIFICATIONS_VIEW', 'PROFILE_EDIT',
  ],
  TREASURER: [
    'DASHBOARD_VIEW', 'EVENTS_VIEW', 'REGISTRATIONS_VIEW', 'PAYMENTS_VIEW', 'PAYMENTS_VERIFY',
    'QR_PASSES_VIEW', 'NOTIFICATIONS_VIEW', 'PROFILE_EDIT',
  ],
  EVENT_MANAGEMENT: [
    'DASHBOARD_VIEW', 'EVENTS_VIEW', 'EVENT_MANAGE', 'EVENT_REGISTER', 'REGISTRATIONS_VIEW',
    'QR_PASSES_VIEW', 'NOTIFICATIONS_VIEW', 'PROFILE_EDIT',
  ],
  MEDIA_LEAD: [
    'DASHBOARD_VIEW', 'EVENTS_VIEW', 'GALLERY_VIEW', 'GALLERY_MANAGE', 'REELS_MANAGE',
    'TEAM_MANAGE', 'NOTIFICATIONS_VIEW', 'PROFILE_EDIT',
  ],
  SOCIAL_MEDIA_LEAD: [
    'DASHBOARD_VIEW', 'EVENTS_VIEW', 'GALLERY_VIEW', 'GALLERY_MANAGE', 'REELS_MANAGE',
    'SETTINGS_MANAGE', 'TEAM_MANAGE', 'NOTIFICATIONS_VIEW', 'PROFILE_EDIT',
  ],
  TECH_TEAM: [
    'DASHBOARD_VIEW', 'EVENTS_VIEW', 'SETTINGS_MANAGE', 'NOTIFICATIONS_VIEW', 'PROFILE_EDIT',
  ],
  PR_TEAM: [
    'DASHBOARD_VIEW', 'EVENTS_VIEW', 'REELS_MANAGE', 'SETTINGS_MANAGE', 'TEAM_MANAGE',
    'NOTIFICATIONS_VIEW', 'PROFILE_EDIT',
  ],
  CULTURAL: [
    'DASHBOARD_VIEW', 'EVENTS_VIEW', 'EVENT_MANAGE', 'NOTIFICATIONS_VIEW', 'PROFILE_EDIT',
  ],
  SECRETARY: [
    'ACCOUNT_MANAGEMENT', 'DASHBOARD_VIEW', 'EVENTS_VIEW', 'REGISTRATIONS_VIEW', 'TEAM_MANAGE',
    'NOTIFICATIONS_VIEW', 'PROFILE_EDIT',
  ],
  ADMIN: [
    'ACCOUNT_MANAGEMENT', 'DASHBOARD_VIEW', 'EVENTS_VIEW', 'EVENT_MANAGE', 'EVENT_REGISTER',
    'REGISTRATIONS_VIEW', 'PAYMENTS_VIEW', 'PAYMENTS_VERIFY', 'GALLERY_VIEW', 'GALLERY_MANAGE',
    'REELS_MANAGE', 'TEAM_MANAGE', 'SETTINGS_MANAGE', 'AUDIT_VIEW', 'NOTIFICATIONS_VIEW', 'PROFILE_EDIT',
  ],
  STUDENT: [
    'DASHBOARD_VIEW', 'EVENTS_VIEW', 'EVENT_REGISTER', 'REGISTRATIONS_VIEW', 'QR_PASSES_VIEW',
    'GALLERY_VIEW', 'CHAT_USE', 'SUGGESTIONS_CREATE', 'FEEDBACK_CREATE', 'NOTIFICATIONS_VIEW', 'PROFILE_EDIT',
  ],
}

function getRolePermissions(role) {
  return ROLE_PERMISSIONS_MAP[role] || ROLE_PERMISSIONS_MAP.STUDENT
}

const PERSONA_ROLES = [
  { id: 'PRESIDENT', label: 'President', emoji: '👑', badge: 'EXEC' },
  { id: 'VICE_PRESIDENT', label: 'Vice President', emoji: '🛡️', badge: 'EXEC' },
  { id: 'STUDENT_COORDINATOR', label: 'Student Coordinator', emoji: '🎓', badge: 'LEAD' },
  { id: 'TECH_TEAM', label: 'Tech Team Lead', emoji: '💻', badge: 'TECH' },
  { id: 'EVENT_MANAGEMENT', label: 'Event Management Lead', emoji: '🎯', badge: 'EVENTS' },
  { id: 'TREASURER', label: 'Treasurer Lead', emoji: '💰', badge: 'FINANCE' },
  { id: 'SECRETARY', label: 'Secretary Lead', emoji: '📜', badge: 'ADMIN' },
  { id: 'MEDIA_LEAD', label: 'Media Lead', emoji: '📸', badge: 'MEDIA' },
  { id: 'SOCIAL_MEDIA_LEAD', label: 'Social Media Lead', emoji: '📱', badge: 'SOCIAL' },
  { id: 'PR_TEAM', label: 'PR Team Lead', emoji: '📢', badge: 'PR' },
  { id: 'CULTURAL', label: 'Cultural Lead', emoji: '🎭', badge: 'CULTURAL' },
  { id: 'ADMIN', label: 'Administrator', emoji: '⚡', badge: 'ADMIN' },
  { id: 'STUDENT', label: 'Student View', emoji: '🧑‍🎓', badge: 'STUDENT' },
]

const CLUB_ROLES = [
  { id: 'STUDENT', label: 'Student Member', roleType: 'student' },
  { id: 'PRESIDENT', label: 'President', roleType: 'admin' },
  { id: 'VICE_PRESIDENT', label: 'Vice President', roleType: 'admin' },
  { id: 'TREASURER', label: 'Treasurer', roleType: 'admin' },
  { id: 'EVENT_MANAGEMENT', label: 'Event Management', roleType: 'admin' },
  { id: 'MEDIA_LEAD', label: 'Media Lead', roleType: 'admin' },
  { id: 'SOCIAL_MEDIA_LEAD', label: 'Social Media Lead', roleType: 'admin' },
  { id: 'TECH_TEAM', label: 'Tech Team', roleType: 'admin' },
  { id: 'PR_TEAM', label: 'PR Team', roleType: 'admin' },
  { id: 'CULTURAL', label: 'Cultural', roleType: 'admin' },
  { id: 'SECRETARY', label: 'Secretary', roleType: 'admin' },
  { id: 'STUDENT_COORDINATOR', label: 'Student Coordinator', roleType: 'admin' },
  { id: 'ADMIN', label: 'Administrator', roleType: 'admin' },
]

const OFFICIAL_COLLEGES_LIST = [
  'ACE Engineering College, Ghatkesar, Hyderabad',
  'Adikavi Nannaya University, Rajahmundry',
  'Aditya College of Engineering & Technology, Surampalem',
  'Aditya Engineering College, Surampalem',
  'Aditya University, Surampalem',
  'AIIMS Bibinagar (All India Institute of Medical Sciences)',
  'AIIMS Mangalagiri',
  'AIIMS New Delhi',
  'Amity University, Hyderabad / National Campuses',
  'Amrita Vishwa Vidyapeetham (Amrita University)',
  'Andhra Loyola Institute of Engineering and Technology, Vijayawada',
  'Andhra University College of Engineering (AUCE), Visakhapatnam',
  'Annamacharya Institute of Technology and Sciences (AITS), Rajampet',
  'Annamacharya Institute of Technology and Sciences (AITS), Tirupati',
  'Annamacharya University, Rajampet',
  'Anurag College of Engineering, Aushapur, Ghatkesar',
  'Anurag Engineering College, Kodad',
  'Anurag University, Venkatapur, Hyderabad',
  'Ashoka Institute of Engineering and Technology, Yadadri',
  'Audisankara College of Engineering & Technology, Gudur',
  'Aurora\'s Degree & PG College, Chikkadpally, Hyderabad',
  'Aurora\'s Engineering College, Bhongir',
  'Aurora\'s Scientific, Technological & Research Academy, Bandlaguda, Hyderabad',
  'AVN Institute of Engineering and Technology (AVNIET), Ibrahimpatnam',
  'B.E.S.T Innovation University, Andhra Pradesh',
  'B.V. Raju Institute of Technology (BVRIT Autonomous), Narsapur, Medak',
  'Bapatla Engineering College, Guntur',
  'Bharat Institute of Engineering and Technology (BIET), Ibrahimpatnam',
  'Bhaskar Engineering College, Yenkapally, Moinabad',
  'BITS Pilani, Goa Campus',
  'BITS Pilani, Hyderabad Campus, Shamirpet',
  'BITS Pilani, Pilani Campus',
  'BMS College of Engineering, Bengaluru',
  'Brilliant Grammar School Educational Society\'s Group of Institutions, Abdullapurmet',
  'Brilliant Institute of Engineering & Technology, Hayathnagar',
  'BVRIT Hyderabad College of Engineering for Women (Autonomous), Bachupally',
  'Central University of Andhra Pradesh (CUAP), Anantapur',
  'Centurion University of Technology and Management, Vizianagaram',
  'Chaitanya (Deemed to be University), Hanamkonda, Warangal',
  'Chaitanya Bharathi Institute of Technology (CBIT Autonomous), Gandipet, Hyderabad',
  'Christ University, Bengaluru / NCR / Lavasa',
  'CMR College of Engineering & Technology (CMRCET Autonomous), Kandlakoya, Medchal',
  'CMR Engineering College (CMREC Autonomous), Kandlakoya, Medchal',
  'CMR Institute of Technology (CMRIT Autonomous), Kandlakoya, Medchal',
  'CMR Technical Campus (CMRTC Autonomous), Kandlakoya, Medchal',
  'College of Engineering Guindy, Anna University, Chennai',
  'College of Engineering, Pune (COEP Technological University)',
  'CVR College of Engineering (Autonomous), Mangalpalli, Ibrahimpatnam',
  'D.Y. Patil International University, Pune',
  'Damodaram Sanjivayya National Law University (DSNLU), Visakhapatnam',
  'Delhi Technological University (DTU), New Delhi',
  'Dhanekula Institute of Engineering and Technology, Ganguru, Vijayawada',
  'Dr. B.R. Ambedkar Open University, Jubilee Hills, Hyderabad',
  'Dr. B.R. Ambedkar University, Srikakulam',
  'Dr. K.V. Subba Reddy Institute of Technology, Kurnool',
  'Dr. YSR Architecture and Fine Arts University, Kadapa',
  'Dravidian University, Srinivasavanam, Kuppam',
  'Ellanki College of Engineering and Technology, Patancheru',
  'English and Foreign Languages University (EFLU), Tarnaka, Hyderabad',
  'G. Narayanamma Institute of Technology and Science for Women (GNITS Autonomous), Shaikpet',
  'G. Pulla Reddy Engineering College (GPREC Autonomous), Kurnool',
  'G. Pullaiah College of Engineering and Technology, Kurnool',
  'Gayatri Vidya Parishad College of Engineering (GVPCE Autonomous), Visakhapatnam',
  'Geethanjali College of Engineering and Technology (GCET Autonomous), Keesara, Hyderabad',
  'GITAM Deemed to be University, Hyderabad Campus, Rudraram',
  'GITAM Deemed to be University, Visakhapatnam Campus',
  'Global Institute of Engineering and Technology, Chilkur, Moinabad',
  'GMR Institute of Technology (GMRIT Autonomous), Rajam',
  'Gokaraju Rangaraju Institute of Engineering and Technology (GRIET Autonomous), Bachupally',
  'Gudlavalleru Engineering College (Seshadri Rao Gudlavalleru), Krishna District',
  'Guru Nanak Institute of Technology (GNIT Autonomous), Ibrahimpatnam',
  'Guru Nanak Institutions Technical Campus (GNITC Autonomous), Ibrahimpatnam',
  'Gurunanak University, Ibrahimpatnam, Hyderabad',
  'Hindustan Institute of Technology and Science (HITS), Padur, Chennai',
  'Holy Mary Institute of Technology & Science (Autonomous), Bogaram, Keesara',
  'Hyderabad Institute of Technology and Management (HITAM Autonomous), Medchal',
  'ICFAI Foundation for Higher Education (IFHE / IBS / FST), Shankarpally, Hyderabad',
  'IIIT Allahabad (Indian Institute of Information Technology)',
  'IIIT Bangalore (International Institute of Information Technology)',
  'IIIT Delhi (Indraprastha Institute of Information Technology)',
  'IIIT Gwalior (ABV-IIITM)',
  'IIIT Hyderabad (International Institute of Information Technology), Gachibowli',
  'IIIT Jabalpur (PDPM IIITDM)',
  'IIIT Kancheepuram (IIITDM)',
  'IIIT Kottayam, Kerala',
  'IIIT Kurnool (Indian Institute of Information Technology Design & Manufacturing)',
  'IIIT Lucknow, Uttar Pradesh',
  'IIIT Nagpur, Maharashtra',
  'IIIT Pune, Maharashtra',
  'IIIT Sri City, Chittoor, Andhra Pradesh',
  'IIIT Vadodara, Gujarat',
  'IIM Ahmedabad',
  'IIM Bangalore',
  'IIM Calcutta',
  'IIM Visakhapatnam',
  'IISc Bangalore (Indian Institute of Science)',
  'IIT Bhubaneswar (Indian Institute of Technology)',
  'IIT Bombay (Indian Institute of Technology Bombay, Powai)',
  'IIT Delhi (Indian Institute of Technology Delhi, Hauz Khas)',
  'IIT Gandhinagar (Indian Institute of Technology)',
  'IIT Guwahati (Indian Institute of Technology)',
  'IIT Hyderabad (Indian Institute of Technology Hyderabad, Kandi, Sangareddy)',
  'IIT Indore (Indian Institute of Technology)',
  'IIT Jodhpur (Indian Institute of Technology)',
  'IIT Kanpur (Indian Institute of Technology Kanpur)',
  'IIT Kharagpur (Indian Institute of Technology)',
  'IIT Madras (Indian Institute of Technology Madras, Chennai)',
  'IIT Mandi (Indian Institute of Technology)',
  'IIT Palakkad (Indian Institute of Technology)',
  'IIT Patna (Indian Institute of Technology)',
  'IIT Roorkee (Indian Institute of Technology Roorkee)',
  'IIT Ropar (Indian Institute of Technology)',
  'IIT Tirupati (Indian Institute of Technology Tirupati, Yerpedu)',
  'IIT Varanasi (BHU - Indian Institute of Technology)',
  'Indian Statistical Institute (ISI), Kolkata / Delhi / Bengaluru / Hyderabad',
  'Indur Institute of Engineering and Technology, Ponnal, Siddipet',
  'Institute of Aeronautical Engineering (IARE Autonomous), Dundigal, Hyderabad',
  'ISL Engineering College, Bandlaguda, Chandrayangutta, Hyderabad',
  'J.B. Institute of Engineering and Technology (JBIET Autonomous), Moinabad, Hyderabad',
  'Jadavpur University, Kolkata',
  'Jamia Millia Islamia, New Delhi',
  'Jawaharlal Nehru Architecture and Fine Arts University (JNAFAU), Masab Tank, Hyderabad',
  'Jawaharlal Nehru Technological University Anantapur (JNTUA)',
  'Jawaharlal Nehru Technological University Gurajada Vizianagaram (JNTUGV)',
  'Jawaharlal Nehru Technological University Kakinada (JNTUK)',
  'JNTU College of Engineering, Anantapur (JNTUACEA Autonomous)',
  'JNTU College of Engineering, Hyderabad (JNTUH UCEH Autonomous), Kukatpally',
  'JNTU College of Engineering, Jagtial (JNTUH UCEJ), Nachupally',
  'JNTU College of Engineering, Kakinada (JNTUCEK Autonomous)',
  'JNTU College of Engineering, Manthani (JNTUH UCEM), Centenary Colony',
  'JNTU College of Engineering, Narasaraopet (JNTUK UCEN)',
  'JNTU College of Engineering, Rajanna Sircilla (JNTUH UCES)',
  'JNTU College of Engineering, Sultanpur (JNTUH UCESP), Sangareddy',
  'JNTU College of Engineering, Vizianagaram (JNTUCEV Autonomous)',
  'JNTU College of Engineering, Wanaparthy (JNTUH UCEW)',
  'Joginpally B.R. Engineering College (JBREC), Yenkapally, Moinabad',
  'Jyothishmathi Institute of Technology and Science, Nustulapur, Karimnagar',
  'K L Deemed to be University, Bowrampet / Aziznagar, Hyderabad Campus',
  'K L Deemed to be University, Vaddeswaram, Guntur / Vijayawada Campus',
  'Kakatiya Institute of Technology and Science (KITS Autonomous), Yerragattu, Warangal',
  'Kakatiya University College of Engineering and Technology (KUCE&T), Warangal',
  'Kalasalingam Academy of Research and Education, Krishnankoil, Tamil Nadu',
  'Kaloji Narayana Rao University of Health Sciences (KNRUHS), Warangal',
  'Kamala Institute of Technology and Science (KITS), Singapuram, Huzurabad',
  'Kasireddy Narayanreddy College of Engineering & Research, Abdullapurmet',
  'Kaveri University, Hyderabad',
  'Keshav Memorial Engineering College (KMEC), Kandlakoya',
  'Keshav Memorial Institute of Technology (KMIT Autonomous), Narayanguda, Hyderabad',
  'KG Reddy College of Engineering and Technology (KGRCET Autonomous), Moinabad',
  'KKR & KSR Institute of Technology and Sciences (KITS Autonomous), Vinjanampadu, Guntur',
  'Kshatriya College of Engineering (KCEA), Armoor, Nizamabad',
  'Lakireddy Bali Reddy College of Engineering (LBRCE Autonomous), Mylavaram, Krishna District',
  'Lords Institute of Engineering and Technology (LIET Autonomous), Himayat Sagar, Hyderabad',
  'Loyola Academy Degree and PG College (Autonomous), Old Alwal, Secunderabad',
  'Madanapalle Institute of Technology and Science (MITS Autonomous), Madanapalle',
  'Madira Institute of Technology and Science, Kodad',
  'Mahatma Gandhi Institute of Technology (MGIT Autonomous), Gandipet, Hyderabad',
  'Mahatma Gandhi University, Anneparthy, Nalgonda',
  'Mahindra University, Bahadurpally, Jeedimetla, Hyderabad',
  'Malla Reddy College of Engineering & Technology (MRCET Autonomous), Maisammaguda, Secunderabad',
  'Malla Reddy College of Engineering (MRCE), Maisammaguda, Secunderabad',
  'Malla Reddy College of Engineering for Women (MRCW), Maisammaguda, Secunderabad',
  'Malla Reddy (MR) Deemed to be University, Maisammaguda, Hyderabad',
  'Malla Reddy Engineering College (MREC Autonomous), Maisammaguda, Secunderabad',
  'Malla Reddy Engineering College for Women (MRECW Autonomous), Maisammaguda, Secunderabad',
  'Malla Reddy Institute of Engineering & Technology (MRIET), Maisammaguda, Secunderabad',
  'Malla Reddy Institute of Medical Sciences (MRIMS), Suraram, Hyderabad',
  'Malla Reddy Institute of Pharmaceutical Sciences, Maisammaguda',
  'Malla Reddy Institute of Technology & Science (MRITS), Maisammaguda, Secunderabad',
  'Malla Reddy Pharmacy College, Maisammaguda',
  'Malla Reddy University (MRU Private University), Maisammaguda, Hyderabad',
  'Malla Reddy Women\'s College, Maisammaguda',
  'Manipal Academy of Higher Education (MAHE - Manipal University), Manipal / Bengaluru',
  'Manipal University, Jaipur',
  'Matrusri Engineering College (MECS Autonomous), Saidabad, Hyderabad',
  'Maulana Azad National Institute of Technology (MANIT), Bhopal',
  'Maulana Azad National Urdu University (MANUU), Gachibowli, Hyderabad',
  'Methodist College of Engineering and Technology (MCET Autonomous), Abids, Hyderabad',
  'MLR Institute of Technology (MLRIT Autonomous), Dundigal, Hyderabad',
  'MNR University / Medical College, Sangareddy',
  'Muffakham Jah College of Engineering and Technology (MJCET), Banjara Hills, Hyderabad',
  'MVGR College of Engineering (Autonomous), Chintalavalasa, Vizianagaram',
  'MVSR Engineering College (Maturi Venkata Subba Rao Autonomous), Nadergul, Hyderabad',
  'NALSAR University of Law, Justice City, Shamirpet, Hyderabad',
  'Nalla Malla Reddy Engineering College (NMREC Autonomous), Divyanagar, Ghatkesar',
  'Nalla Narasimha Reddy Education Society\'s Group of Institutions (NNRG Autonomous), Chowdariguda, Ghatkesar',
  'Narasaraopeta Engineering College (NEC Autonomous), Narasaraopet',
  'National Institute of Design (NID), Ahmedabad / Andhra Pradesh',
  'National Institute of Fashion Technology (NIFT), Madhapur, Hyderabad',
  'National Institute of Technology Calicut (NITC)',
  'National Institute of Technology Karnataka (NITK Surathkal)',
  'National Institute of Technology Rourkela (NIT Rourkela)',
  'National Institute of Technology Tiruchirappalli (NIT Trichy)',
  'National Institute of Technology Warangal (NIT Warangal / NITW)',
  'National Institute of Technology, Andhra Pradesh (NIT Tadepalligudem)',
  'Nawab Shah Alam Khan College of Engineering and Technology, New Malakpet, Hyderabad',
  'Neil Gogte Institute of Technology (NGIT), Peerzadiguda, Uppal, Hyderabad',
  'Netaji Subhas University of Technology (NSUT), New Delhi',
  'NICMAR University, Shamirpet, Hyderabad',
  'NMIMS Deemed to be University, Jadcherla / Tarnaka, Hyderabad Campus',
  'Osmania University College of Engineering (OUCE Autonomous), University Campus, Hyderabad',
  'Osmania University College of Technology (OUCT Autonomous), University Campus, Hyderabad',
  'Osmania University (Main Campus), Tarnaka, Hyderabad',
  'Palamuru University, Bandameedipally, Mahabubnagar',
  'PES University, Ring Road / Electronic City, Bengaluru',
  'Pragati Engineering College (Autonomous), Surampalem, Kakinada',
  'Prasad V. Potluri Siddhartha Institute of Technology (PVPSIT Autonomous), Kanuru, Vijayawada',
  'Princeton Institute of Engineering and Technology for Women, Chowdaryguda, Ghatkesar',
  'Professor Jayashankar Telangana State Agricultural University (PJTSAU), Rajendranagar, Hyderabad',
  'PSG College of Technology, Peelamedu, Coimbatore',
  'R.V. College of Engineering (RVCE), Bengaluru',
  'Rajiv Gandhi University of Knowledge Technologies (RGUKT - IIIT Basar), Nirmal, Telangana',
  'Rajiv Gandhi University of Knowledge Technologies (RGUKT - IIIT Nuzvid), Andhra Pradesh',
  'Rajiv Gandhi University of Knowledge Technologies (RGUKT - IIIT RK Valley / Idupulapaya), Kadapa',
  'Rajiv Gandhi University of Knowledge Technologies (RGUKT - IIIT Srikakulam), Andhra Pradesh',
  'Rajiv Gandhi University of Knowledge Technologies (RGUKT - IIIT Ongole), Andhra Pradesh',
  'Rashtriya Sanskrit Vidyapeetha (National Sanskrit University), Tirupati',
  'RGM College of Engineering and Technology (RGMCET Autonomous), Nandyal',
  'S.R. International Institute of Technology (SRIIT), Rampally, Keesara',
  'Sai Spurthi Institute of Technology, B. Gangaram, Sathupally, Khammam',
  'Sammakka Sarakka Central Tribal University, Mulugu, Telangana',
  'Samskruti College of Engineering and Technology, Kondapur, Ghatkesar',
  'Santhiram Engineering College, Nandyal',
  'Sardar Vallabhbhai National Institute of Technology (SVNIT), Surat',
  'Satavahana University, Malkapur Road, Karimnagar',
  'Scient Institute of Technology, Ibrahimpatnam',
  'Seshadri Rao Gudlavalleru Engineering College (SRGEC Autonomous), Gudlavalleru',
  'Shadan College of Engineering and Technology, Peerancheru, Himayat Sagar Road, Hyderabad',
  'Shadan Women\'s College of Engineering and Technology, Khairatabad, Hyderabad',
  'Shiv Nadar University, Greater Noida, Delhi-NCR / Chennai',
  'Shri Ramdeobaba College of Engineering and Management (RCOEM), Nagpur',
  'Siddhartha Academy of Higher Education, Vijayawada',
  'Siddhartha Institute of Engineering and Technology, Vinobha Nagar, Ibrahimpatnam',
  'Siddhartha Institute of Technology and Sciences, Narapally, Korremula, Ghatkesar',
  'Sphoorthy Engineering College (Autonomous), Nadergul, Sagar Road, Hyderabad',
  'SR University (SRU Private University), Ananthasagar, Hasanparthy, Warangal',
  'Sree Chaitanya College of Engineering, LMD Colony, Karimnagar',
  'Sree Dattha Group of Educational Institutions, Sheriguda, Ibrahimpatnam',
  'Sree Dattha Institute of Engineering and Science, Sheriguda, Ibrahimpatnam',
  'Sree Rama Engineering College, Rami Reddy Nagar, Tirupati',
  'Sree Vahini Institute of Science and Technology, Tiruvuru, Krishna District',
  'Sree Venkateswara College of Engineering, Golden Nagar, Kodavalur, Nellore',
  'Sree Vidyanikethan Engineering College (Mohan Babu University), Sree Sainath Nagar, Tirupati',
  'Sreenidhi Institute of Science and Technology (SNIST Autonomous), Yamnampet, Ghatkesar',
  'Sreenidhi University, Ghatkesar, Hyderabad',
  'Sreyas Institute of Engineering and Technology (Autonomous), Bandlaguda, Nagole, Hyderabad',
  'Sri Chandrasekharendra Saraswathi Viswa Mahavidyalaya (SCSVMV University), Kanchipuram',
  'Sri Indu College of Engineering and Technology (Autonomous), Sheriguda, Ibrahimpatnam',
  'Sri Indu Institute of Engineering and Technology, Sheriguda, Ibrahimpatnam',
  'Sri Konda Laxman Telangana State Horticultural University, Mulugu, Siddipet',
  'Sri Padmavati Mahila Visvavidyalayam (Women\'s University), Padmavathi Nagar, Tirupati',
  'Sri Sai Jyothi Engineering College, Vattinagulapally, Gandipet',
  'Sri Sairam Engineering College, West Tambaram, Chennai',
  'Sri Sathya Sai Institute of Higher Learning, Prasanthi Nilayam, Puttaparthi',
  'Sri Sivani College of Engineering, Chilakapalem, Srikakulam',
  'Sri Vasavi Engineering College (Autonomous), Pedatadepalli, Tadepalligudem',
  'Sri Venkateswara College of Engineering and Technology (SVCET Autonomous), R.V.S. Nagar, Chittoor',
  'Sri Venkateswara College of Engineering, Karakambadi Road, Tirupati',
  'Sri Venkateswara University College of Engineering (SVUCE Autonomous), Tirupati',
  'Sri Venkateswara University (SVU), Tirupati',
  'Sri Venkateswara Veterinary University, Tirupati',
  'SRM Institute of Science and Technology (SRM University - Kattankulathur / Ramapuram), Chennai',
  'SRM University AP, Neerukonda, Mangalagiri, Amaravati, Andhra Pradesh',
  'SSN College of Engineering, Kalavakkam, Chennai',
  'St. Ann\'s College of Engineering & Technology, Nayunipalli, Chirala',
  'St. Joseph\'s Degree & PG College, King Koti, Hyderabad',
  'St. Martin\'s Engineering College (SMEC Autonomous), Dhulapally, Secunderabad',
  'St. Mary\'s Engineering College, Deshmukhi, Pochampally',
  'St. Mary\'s Group of Institutions, Chebrolu, Guntur / Deshmukhi, Hyderabad',
  'St. Peter\'s Engineering College (Autonomous), Maisammaguda, Medchal',
  'Stanley College of Engineering and Technology for Women (Autonomous), Chapel Road, Abids, Hyderabad',
  'Sumathi Reddy Institute of Technology for Women, Ananthasagar, Hasanparthy, Warangal',
  'Suravaram Prathapa Reddy Telugu University, Public Gardens, Hyderabad',
  'Symbiosis International University (SIU), Mamidipally, Hyderabad / Pune',
  'Talla Padmavathi College of Engineering, Somidi, Kazipet, Warangal',
  'Teegala Krishna Reddy Engineering College (TKREC), Medbowli, Meerpet, Hyderabad',
  'Telangana University, Dichpally, Nizamabad',
  'Thapar Institute of Engineering and Technology (TIET), Patiala, Punjab',
  'TKR College of Engineering and Technology (TKRCET Autonomous), Medbowli, Meerpet, Hyderabad',
  'Trinity College of Engineering and Technology, Bandarikunta, Peddapalli / Karimnagar',
  'University College of Engineering, Kakatiya University, Kothagudem',
  'University College of Engineering, Osmania University (UCEOU Autonomous), Hyderabad',
  'University College of Technology, Osmania University (OUCT Autonomous), Hyderabad',
  'University of Delhi (DU), New Delhi',
  'University of Hyderabad (UoH / HCU Central University), Gachibowli, Hyderabad',
  'Usha Rama College of Engineering and Technology, Telaprolu, Unguturu, Krishna District',
  'Vaagdevi College of Engineering (Autonomous), Bollikunta, Warangal',
  'Vaagdevi Engineering College, Bollikunta, Warangal',
  'Vageshwari College of Engineering, Ramakrishna Colony, Karimnagar',
  'Vardhaman College of Engineering (Autonomous), Kacharam, Shamshabad, Hyderabad',
  'Vasavi College of Engineering (VCE Autonomous), Ibrahimbagh, Hyderabad',
  'Veera Naari Chakali Ilamma Women\'s University (TMV), Koti, Hyderabad',
  'Vel Tech Rangarajan Dr. Sagunthala R&D Institute of Science and Technology, Avadi, Chennai',
  'Vellore Institute of Technology (VIT Bhopal University), Kothri Kalan, Madhya Pradesh',
  'Vellore Institute of Technology (VIT University), Katpadi, Vellore / Chennai',
  'Vellore Institute of Technology (VIT-AP University), Inavolu, Beside AP Secretariat, Amaravati',
  'Vidya Jyothi Institute of Technology (VJIT Autonomous), Aziznagar Gate, C.B. Post, Hyderabad',
  'Vignan Institute of Technology and Science (VITS Autonomous), Deshmukhi, Pochampally',
  'Vignan\'s Foundation for Science, Technology and Research (Vignan University), Vadlamudi, Guntur',
  'Vignan\'s Institute of Information Technology (VIIT Autonomous), Duvvada, Visakhapatnam',
  'Vignan\'s Institute of Management and Technology for Women (VMTW), Kondapur, Ghatkesar',
  'Vignana Bharathi Institute of Technology (VBIT Autonomous), Aushapur, Ghatkesar',
  'Vijaya Krishna Institute of Technology & Sciences, Palamakula, Shamshabad',
  'Vikas College of Engineering and Technology, Nunna, Vijayawada',
  'Vikrama Simhapuri University, Kakutur, Nellore',
  'Vishwa Vishwani Institute of Systems and Management, Boston House, Thumkunta',
  'Vishnu Institute of Technology (VITB Autonomous), Vishnupur, Kovvada, Bhimavaram',
  'Visvesvaraya National Institute of Technology (VNIT), South Ambazari Road, Nagpur',
  'Vivekanandha College of Engineering for Women (Autonomous), Elayampalayam, Tiruchengode',
  'VNR Vignana Jyothi Institute of Engineering and Technology (VNR VJIET Autonomous), Bachupally, Hyderabad',
  'VR Siddhartha Engineering College (VRSEC Autonomous), Kanuru, Vijayawada',
  'Woxsen University, Kamkole, Sadasivpet, Sangareddy, Telangana',
  'Yogi Vemana University (YVU), Vemanapuram, Kadapa',
  'Young India Skill University (YISU), Hyderabad',
  'Other / External University (Specify Below)',
]

const BRANCH_OPTIONS = ['Cyber Security', 'CSE', 'AI & ML', 'Data Science', 'ECE', 'EEE', 'CE', 'ME', 'IT', 'BBA', 'MBA', 'IoT']
const CSE_SPECIALIZATIONS = ['AIML', 'CS', 'DS', 'General', 'IT', 'IOT', 'AIDS']
const ACADEMIC_YEARS = [
  { value: 1, label: '1st Year (Freshman / UG)' },
  { value: 2, label: '2nd Year (Sophomore / UG)' },
  { value: 3, label: '3rd Year (Junior / UG)' },
  { value: 4, label: '4th Year (Senior / UG)' },
  { value: 5, label: 'Postgraduate (M.Tech / MCA / MS / MBA)' },
  { value: 6, label: 'PhD / Research Scholar' },
]

function getRoleLabel(roleId) {
  const r = CLUB_ROLES.find(item => item.id === roleId)
  return r ? r.label : roleId
}

function Crest({ platformMode = 'CYBER_SECURITY_CLUB', small = false, showBanner = false }) {
  const isMrdu = platformMode === 'MRDU_EVENTS'

  if (isMrdu) {
    if (showBanner) {
      return (
        <div className="crest official-crest" style={{ display: 'inline-flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ background: '#ffffff', padding: '6px 14px', borderRadius: '10px', border: '1px solid rgba(211, 47, 47, 0.3)', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
            <img
              className="brand-logo"
              src={mrduBanner}
              alt="Malla Reddy (MR) Deemed to be University"
              style={{ maxHeight: small ? 38 : 64, objectFit: 'contain', width: 'auto' }}
            />
          </div>
          {!small && (
            <div className="wordmark">
              <span style={{ font: '700 13px "Plus Jakarta Sans", sans-serif', letterSpacing: '.12em', color: 'var(--brand-eyebrow, #ea580c)' }}>MALLA REDDY UNIVERSITY</span>
              <strong style={{ font: '800 24px "Plus Jakarta Sans", sans-serif', letterSpacing: '.04em', color: 'var(--text-main)', display: 'block' }}>CENTRAL EVENTS PORTAL</strong>
              <small style={{ color: 'var(--text-muted)', font: '500 9px "DM Mono", monospace', letterSpacing: '.08em', marginTop: '2px', display: 'block' }}>
                ALL DEPARTMENTS, INSTITUTES & TECHNICAL SOCIETIES
              </small>
            </div>
          )}
        </div>
      )
    }

    return (
      <div className={`crest official-crest ${small ? 'small' : ''}`} style={{ display: 'inline-flex', alignItems: 'center', gap: small ? '10px' : '14px' }}>
        <img
          className="brand-logo"
          src={mrduOfficialLogo}
          alt="Malla Reddy (MR) Deemed to be University"
          style={{
            height: small ? 38 : 56,
            width: 'auto',
            objectFit: 'contain',
            filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.1))',
          }}
        />
        {!small && (
          <div className="wordmark">
            <span style={{ font: '700 13px "Plus Jakarta Sans", sans-serif', letterSpacing: '.08em', color: 'var(--brand-eyebrow, #ea580c)' }}>MALLA REDDY (MR)</span>
            <strong style={{ font: '800 20px "Plus Jakarta Sans", sans-serif', letterSpacing: '-.02em', color: 'var(--text-main)' }}>DEEMED TO BE UNIVERSITY</strong>
            <small style={{ color: 'var(--text-muted)', font: '500 9px "DM Mono", monospace', letterSpacing: '.08em', marginTop: '3px' }}>
              OFFICIAL CENTRAL EVENTS PORTAL
            </small>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`crest official-crest ${small ? 'small' : ''}`} style={{ display: 'inline-flex', alignItems: 'center', gap: small ? '10px' : '16px' }}>
      <img
        className="brand-logo"
        src={clubLogo}
        alt="Cyber Security Club official emblem"
        style={{
          width: small ? 38 : 78,
          height: small ? 38 : 78,
          objectFit: 'contain',
          borderRadius: small ? 8 : 12,
          boxShadow: '0 0 16px rgba(61, 165, 255, .25)',
          background: '#040911',
        }}
      />
      {!small && (
        <div className="wordmark">
          <span style={{ font: '600 15px Syne', letterSpacing: '.08em' }}>CYBER SECURITY</span>
          <strong style={{ font: '800 26px Syne', letterSpacing: '.14em', color: 'var(--text-main)' }}>CLUB</strong>
          <small style={{ color: 'var(--brand-eyebrow)', font: '500 9px "DM Mono", monospace', letterSpacing: '.08em', marginTop: '4px' }}>
            MRDU · DEPARTMENT OF CYBER SECURITY
          </small>
        </div>
      )}
    </div>
  )
}

function toPortalUser(user) {
  const isStudentRole = user.role === 'STUDENT'
  const name = user.profile?.name || user.name || 'Member'
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase() || 'CS'
  return {
    id: user.id,
    role: user.role,
    isPrimaryAdmin: Boolean(user.isPrimaryAdmin),
    isAdminUser: !isStudentRole,
    name,
    initials,
    memberId: user.memberId,
    permissions: user.permissions || [],
    twoFactorEnabled: user.twoFactorEnabled || false,
    profile: user.profile || {},
    isImpersonating: Boolean(user.isImpersonating),
    originalAdmin: user.originalAdmin || null,
  }
}

// ----------------------------------------------------
// ----------------------------------------------------
// Mandatory Student Onboarding Video Experience (Guaranteed YouTube Player)
// ----------------------------------------------------
function IntroVideoExperience({ onComplete }) {
  const [videoUrl, setVideoUrl] = useState('https://www.youtube.com/watch?v=gokPW83s7nA')
  const [secondsWatched, setSecondsWatched] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [canProceed, setCanProceed] = useState(false)
  const [completing, setCompleting] = useState(false)
  const iframeRef = useRef(null)

  const REQUIRED_DURATION = 120 // Compulsory 2 minutes (120 seconds)

  // 1. Fetch configured video URL from club settings (defaults directly to specified video)
  useEffect(() => {
    let mounted = true
    memberApi.getPublicClubSettings()
      .then(({ settings }) => {
        if (!mounted) return
        if (settings?.introVideoUrl && typeof settings.introVideoUrl === 'string' && settings.introVideoUrl.trim()) {
          setVideoUrl(settings.introVideoUrl.trim())
        }
      })
      .catch(() => {})
    return () => { mounted = false }
  }, [])

  const youtubeId = parseYouTubeVideoId(videoUrl) || 'gokPW83s7nA'

  // 2. Active timer: ticks every 1 second continuously while video orientation screen is active
  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsWatched(prev => {
        const next = prev + 1
        if (next >= REQUIRED_DURATION) {
          setCanProceed(true)
        }
        return next
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [REQUIRED_DURATION])

  // 3. YouTube postMessage Listener for video events
  useEffect(() => {
    function handleMessage(event) {
      if (!event.data) return
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
        let playerState = undefined
        if (data.event === 'onStateChange' && data.data !== undefined) {
          playerState = data.data
        } else if (data.info && data.info.playerState !== undefined) {
          playerState = data.info.playerState
        }

        if (playerState === 1) { // PLAYING
          setIsPlaying(true)
        } else if (playerState === 2) { // PAUSED
          setIsPlaying(false)
        } else if (playerState === 0) { // ENDED
          setCanProceed(true)
        }
      } catch {}
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  async function handleFinish() {
    if (!canProceed || completing) return
    setCompleting(true)
    try {
      await memberApi.completeIntroVideo()
    } catch {}
    onComplete()
  }

  const remainingSeconds = Math.max(0, REQUIRED_DURATION - secondsWatched)
  const progressPercent = Math.min(100, Math.round((secondsWatched / REQUIRED_DURATION) * 100))

  return (
    <div className="intro-video-overlay" style={{ zIndex: 999999, background: 'rgba(2, 6, 12, 0.96)', backdropFilter: 'blur(16px)' }}>
      <div className="intro-video-container" style={{ maxWidth: '980px', width: '100%', borderRadius: '16px', border: '1px solid var(--brand-border-subtle)', background: 'var(--bg-card)', boxShadow: '0 0 80px rgba(0,0,0,0.9)' }}>
        {/* Header with Live Countdown & Status */}
        <div className="intro-video-header" style={{ padding: '16px 24px', background: 'var(--bg-input)', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: canProceed ? '#70ddb4' : 'var(--brand-primary)', boxShadow: `0 0 8px ${canProceed ? '#70ddb4' : 'var(--brand-primary)'}` }} />
              <b style={{ font: '700 14px Syne', color: 'var(--text-main)', letterSpacing: '.04em' }}>
                MANDATORY STUDENT ONBOARDING BRIEFING
              </b>
            </div>
            <small style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>
              Please watch the official 2-minute orientation video completely to unlock access to your portal and events.
            </small>
          </div>

          {/* Big Digital Timer Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              background: canProceed ? 'rgba(16, 185, 129, 0.15)' : 'var(--brand-badge-bg)',
              border: `1px solid ${canProceed ? '#10b981' : 'var(--brand-primary)'}`,
              padding: '6px 14px',
              borderRadius: '8px',
              textAlign: 'right',
            }}>
              <span style={{
                color: canProceed ? '#70ddb4' : 'var(--brand-primary)',
                font: '700 13px "DM Mono", monospace',
                letterSpacing: '.08em',
                display: 'block',
              }}>
                {canProceed ? '✓ 2:00 COMPLETED' : `TIME: ${Math.floor(secondsWatched / 60)}:${String(secondsWatched % 60).padStart(2, '0')} / 2:00`}
              </span>
              <small style={{ color: 'var(--text-muted)', fontSize: '9px', font: '500 9px "DM Mono", monospace' }}>
                {canProceed ? 'REQUIREMENT SATISFIED' : `${remainingSeconds}s REMAINING (${progressPercent}%)`}
              </small>
            </div>
          </div>
        </div>

        {/* Animated Progress Bar Strip */}
        <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.06)', position: 'relative' }}>
          <div style={{
            height: '100%',
            width: `${progressPercent}%`,
            background: canProceed ? 'linear-gradient(90deg, #10b981, #70ddb4)' : 'var(--brand-gradient)',
            transition: 'width 1s linear',
            boxShadow: canProceed ? '0 0 12px #70ddb4' : '0 0 12px var(--brand-glow)',
          }} />
        </div>

        {/* YouTube Video Player (Always Forced & Reliable) */}
        <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', minHeight: '440px', background: '#000000', overflow: 'hidden' }}>
          <iframe
            id="youtube-player-iframe"
            ref={iframeRef}
            src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&controls=1&rel=0&playsinline=1&enablejsapi=1&modestbranding=1`}
            title="Student Onboarding Orientation Video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            style={{ width: '100%', height: '100%', border: 0, position: 'absolute', top: 0, left: 0 }}
          />
        </div>

        {/* Footer with Live Instructions and Entry Action */}
        <div style={{ padding: '18px 24px', background: 'var(--bg-input)', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ display: 'inline-flex', padding: '6px', borderRadius: '50%', background: canProceed ? 'rgba(16, 185, 129, 0.15)' : 'var(--brand-badge-bg)', color: canProceed ? '#10b981' : 'var(--brand-primary)' }}>
              {canProceed ? <IconCheckCircle size={18} /> : <IconSparkles size={18} />}
            </span>
            <div>
              <p style={{ margin: 0, color: 'var(--text-main)', fontSize: '12px', fontWeight: 600 }}>
                {canProceed
                  ? 'Orientation video requirement complete!'
                  : `Watching orientation briefing... (${remainingSeconds} seconds remaining)`}
              </p>
              <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                {canProceed
                  ? 'Click the button below to proceed to your student dashboard.'
                  : 'Click the video player if autoplay was paused by your browser.'}
              </small>
            </div>
          </div>

          <button
            className="primary"
            type="button"
            disabled={!canProceed || completing}
            onClick={handleFinish}
            style={{
              padding: '0 28px',
              minHeight: '44px',
              fontSize: '11px',
              background: canProceed ? 'linear-gradient(105deg, #059669, #10b981)' : undefined,
              borderColor: canProceed ? '#10b981' : undefined,
              color: canProceed ? '#ffffff' : undefined,
              cursor: canProceed ? 'pointer' : 'not-allowed',
            }}
          >
            {completing
              ? 'PREPARING DASHBOARD…'
              : canProceed
              ? 'ENTER PORTAL DASHBOARD →'
              : `COMPLETE VIDEO (${remainingSeconds}s)`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ----------------------------------------------------
// Concurrent Waiting Queue
// ----------------------------------------------------
function ConcurrentWaitingQueue({ onComplete }) {
  const [countdown, setCountdown] = useState(5)

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          memberApi.completeWaitingQueue().finally(() => onComplete())
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [onComplete])

  return (
    <div className="queue-overlay">
      <div className="queue-card">
        <Crest small />
        <h2 style={{ font: '700 22px Syne', color: 'var(--text-main)', margin: '16px 0 6px' }}>High Member Activity</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.6' }}>
          More than 20 students are actively connected. Allocating secure session slot...
        </p>
        <div className="queue-timer">{countdown}</div>
        <small style={{ color: 'var(--text-dim)', font: '500 10px "DM Mono", monospace' }}>ENTERING AUTOMATICALLY...</small>
      </div>
    </div>
  )
}

// ----------------------------------------------------
// Hibernation Mode Screen (Dedicated Sleep Mode with Live Timer)
// ----------------------------------------------------
function HibernationScreen({ onAdminLogin }) {
  const [startedAt, setStartedAt] = useState(null)
  const [elapsed, setElapsed] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })

  useEffect(() => {
    let mounted = true
    memberApi.getPublicClubSettings()
      .then(({ settings }) => {
        if (mounted && settings?.hibernationStartedAt) {
          setStartedAt(new Date(settings.hibernationStartedAt))
        }
      })
      .catch(() => {})
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    function calculateElapsed() {
      const start = startedAt ? new Date(startedAt).getTime() : Date.now()
      const diff = Math.max(0, Date.now() - start)

      const seconds = Math.floor((diff / 1000) % 60)
      const minutes = Math.floor((diff / (1000 * 60)) % 60)
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
      const days = Math.floor(diff / (1000 * 60 * 60 * 24))

      setElapsed({ days, hours, minutes, seconds })
    }

    calculateElapsed()
    const timer = setInterval(calculateElapsed, 1000)
    return () => clearInterval(timer)
  }, [startedAt])

  return (
    <div className="hibernation-page">
      <div className="grid-overlay" />
      <div className="hibernation-card">
        <Crest />
        <span className="hibernation-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <IconAlertTriangle size={13} /> SITE STATUS · HIBERNATION ACTIVE
        </span>
        <h1 className="hibernation-title">PORTAL IN HIBERNATION</h1>
        <p className="hibernation-desc">
          The Cyber Security Club website is temporarily in hibernation mode for scheduled community maintenance.
        </p>

        <div className="hibernation-timer-box">
          <div className="hibernation-timer-label">ELAPSED HIBERNATION DURATION</div>
          <div className="hibernation-timer-grid">
            <div className="timer-block">
              <span className="timer-num">{String(elapsed.days).padStart(2, '0')}</span>
              <span className="timer-unit">DAYS</span>
            </div>
            <div className="timer-block">
              <span className="timer-num">{String(elapsed.hours).padStart(2, '0')}</span>
              <span className="timer-unit">HOURS</span>
            </div>
            <div className="timer-block">
              <span className="timer-num">{String(elapsed.minutes).padStart(2, '0')}</span>
              <span className="timer-unit">MINUTES</span>
            </div>
            <div className="timer-block">
              <span className="timer-num">{String(elapsed.seconds).padStart(2, '0')}</span>
              <span className="timer-unit">SECONDS</span>
            </div>
          </div>
        </div>

        <button type="button" className="hibernation-admin-btn" onClick={onAdminLogin} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <IconCrown size={14} /> President & Admin Gateway &rarr;
        </button>
      </div>
    </div>
  )
}

// ----------------------------------------------------
// Icons8 & Vector Icon System (Crisp Theme-Adaptive Assets)
// ----------------------------------------------------
function Icon8({ name, size = 18, style = {}, className = '', alt = '' }) {
  const iconMap = {
    access: '/icons8/icons8-access-50.png',
    authentication: '/icons8/icons8-authentication-50.png',
    captcha: '/icons8/icons8-captcha-50.png',
    faceId: '/icons8/icons8-face-id-50.png',
    fingerprint: '/icons8/icons8-fingerprint-50.png',
    idDocs: '/icons8/icons8-identification-documents-50.png',
    irisScan: '/icons8/icons8-iris-scan-50.png',
    keySecurity: '/icons8/icons8-key-security-50.png',
    password: '/icons8/icons8-password-50.png',
    protect: '/icons8/icons8-protect-50.png',
    realtime: '/icons8/icons8-realtime-50.png',
    showPassword: '/icons8/icons8-show-password-50.png',
    user: '/icons8/icons8-male-user-50.png',
    bookmark: '/icons8/icons8-add-bookmark-50.png',
    sun: '/icons8/icons8-sun-50.png',
    document: '/icons8/icons8-document-50.png',
    pointer: '/icons8/icons8-3d-pointer-50.png',
    handCursor: '/icons8/icons8-hand-cursor-50.png',
  }
  const src = iconMap[name] || iconMap.protect
  return (
    <img
      src={src}
      alt={alt || name}
      className={`icon8-img ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        objectFit: 'contain',
        verticalAlign: 'middle',
        display: 'inline-block',
        ...style,
      }}
    />
  )
}

function IconSun({ size = 15, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', ...style }}>
      <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

function IconMoon({ size = 15, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', ...style }}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

function IconMonitor({ size = 15, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', ...style }}>
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  )
}

function IconBell({ size = 16, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', ...style }}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

function IconDownload({ size = 14, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', ...style }}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

function IconCrown({ size = 14, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', ...style }}>
      <polygon points="2 4 5 20 19 20 22 4 15 10 12 2 9 10 2 4" />
    </svg>
  )
}

function IconCalendar({ size = 13, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', ...style }}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function IconLocationPin({ size = 13, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', ...style }}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function IconCreditCard({ size = 13, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', ...style }}>
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  )
}

function IconAlertTriangle({ size = 16, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', ...style }}>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

function IconCheckCircle({ size = 15, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', ...style }}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

function IconSearchSvg({ size = 14, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', ...style }}>
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function IconUserSvg({ size = 13, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', ...style }}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function IconHeart({ size = 18, filled = false, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? '#ef4444' : 'none'} stroke={filled ? '#ef4444' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)', ...style }}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

function IconLink({ size = 16, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', ...style }}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  )
}

function IconChevronUp({ size = 16, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', ...style }}>
      <polyline points="18 15 12 9 6 15" />
    </svg>
  )
}

function IconChevronDown({ size = 16, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', ...style }}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function IconTrash({ size = 14, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', ...style }}>
      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

function IconRefresh({ size = 14, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', ...style }}>
      <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  )
}

function IconInstagram({ size = 16, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', ...style }}>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  )
}

function IconYouTube({ size = 16, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', ...style }}>
      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" /><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
    </svg>
  )
}

function IconLinkedIn({ size = 16, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', ...style }}>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" /><rect x="2" y="9" width="4" height="12" /><circle cx="4" cy="4" r="2" />
    </svg>
  )
}

function IconGitHub({ size = 16, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', ...style }}>
      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
    </svg>
  )
}

function IconDiscord({ size = 16, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', ...style }}>
      <path d="M18 6h0a14.5 14.5 0 0 0-4-1.5l-.2.5a12.5 12.5 0 0 0-3.6 0l-.2-.5A14.5 14.5 0 0 0 6 6a15.8 15.8 0 0 0-2 10c2 1.5 4 1.5 4 1.5l.6-.8a9.4 9.4 0 0 1-2.4-1.2l.2-.2c3.4 1.6 7.2 1.6 10.6 0l.2.2a9.4 9.4 0 0 1-2.4 1.2l.6.8s2 0 4-1.5a15.8 15.8 0 0 0-2-10z" /><circle cx="9" cy="12" r="1" fill="currentColor" /><circle cx="15" cy="12" r="1" fill="currentColor" />
    </svg>
  )
}

function IconWhatsApp({ size = 16, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', ...style }}>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  )
}

function IconGlobe({ size = 16, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', ...style }}>
      <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
}

function IconMail({ size = 16, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', ...style }}>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
    </svg>
  )
}

function IconQrCode({ size = 16, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', ...style }}>
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" />
      <line x1="7" y1="7" x2="7.01" y2="7" strokeWidth="3" /><line x1="17" y1="7" x2="17.01" y2="7" strokeWidth="3" /><line x1="7" y1="17" x2="7.01" y2="17" strokeWidth="3" />
    </svg>
  )
}

function IconUsers({ size = 16, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', ...style }}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function IconUpload({ size = 16, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', ...style }}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

function IconHeadset({ size = 16, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', ...style }}>
      <path d="M3 18v-6a9 9 0 0 1 18 0v6" /><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
    </svg>
  )
}

function IconFlame({ size = 14, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', ...style }}>
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3.5z" />
    </svg>
  )
}

function IconVideo({ size = 16, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', ...style }}>
      <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  )
}

function IconExternalLink({ size = 13, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', ...style }}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  )
}

function IconShieldCheck({ size = 16, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', ...style }}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" />
    </svg>
  )
}

function IconSparkles({ size = 16, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', ...style }}>
      <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z" />
    </svg>
  )
}

function IconEye({ size = 16, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', ...style }}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function IconEyeOff({ size = 16, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', ...style }}>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

function IconCopy({ size = 13, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', ...style }}>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function IconLifebuoy({ size = 14, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', ...style }}>
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="4" /><line x1="4.93" y1="4.93" x2="9.17" y2="9.17" /><line x1="14.83" y1="14.83" x2="19.07" y2="19.07" /><line x1="14.83" y1="9.17" x2="19.07" y2="4.93" /><line x1="4.93" y1="19.07" x2="9.17" y2="14.83" />
    </svg>
  )
}

// ----------------------------------------------------
// Navigation, Header & LivePortal Frame
// ----------------------------------------------------
function Sidebar({ user, logout, activeTab, onNavigate, isOpen, onClose }) {
  const { platformMode, reelsEnabled, subEnabled } = usePlatformTheme()
  const isMrdu = platformMode === 'MRDU_EVENTS'
  const perms = user.permissions || []
  const has = perm => user.isPrimaryAdmin || perms.includes(perm)

  const isSuper = user.isPrimaryAdmin || user.role === 'PRESIDENT' || user.role === 'STUDENT_COORDINATOR' || user.role === 'ADMIN'

  const navItems = user.isAdminUser
    ? [
        [<Icon8 name="protect" size={17} />, isMrdu ? 'Portal Home' : 'Dashboard', 'admin-dashboard', true],
        [<Icon8 name="faceId" size={17} />, 'QR Entry Gate', 'admin-qr-scanner', has('EVENTS_VIEW') || has('EVENT_MANAGE') || user.isAdminUser],
        [<Icon8 name="idDocs" size={17} />, isMrdu ? 'Participants' : 'Members', 'admin-members', has('ACCOUNT_MANAGEMENT') || isSuper || ['VICE_PRESIDENT', 'SECRETARY'].includes(user.role)],
        [<IconShieldCheck size={17} />, 'Coordinator Console', 'admin-coordinator', user.role === 'STUDENT_COORDINATOR' || user.isPrimaryAdmin || user.role === 'PRESIDENT' || user.role === 'ADMIN'],
        [<Icon8 name="realtime" size={17} />, 'Event Studio', 'admin-events', has('EVENTS_VIEW') || has('EVENT_MANAGE') || isSuper],
        [<Icon8 name="access" size={17} />, isMrdu ? 'Pass Subscriptions' : 'Subscriptions', 'admin-subscriptions', has('PAYMENTS_VIEW') || user.role === 'TREASURER' || isSuper],
        [<Icon8 name="authentication" size={17} />, isMrdu ? 'Passes & Payments' : 'Passes & Check-in', 'admin-passes', has('PAYMENTS_VIEW') || has('EVENTS_VIEW') || user.isAdminUser],
        [<Icon8 name="captcha" size={17} />, 'Helpdesk & Doubts', 'admin-support', true],
        [<Icon8 name="protect" size={17} />, 'Council Room', 'admin-chat', true],
        [<Icon8 name="irisScan" size={17} />, isMrdu ? 'Event Gallery' : 'Gallery', 'admin-gallery', has('GALLERY_VIEW') || has('GALLERY_MANAGE') || isSuper],
        [<Icon8 name="realtime" size={17} />, isMrdu ? 'MRDU Reels Studio' : 'Reels Studio', 'admin-reels', has('REELS_MANAGE') || has('GALLERY_MANAGE') || isSuper || ['VICE_PRESIDENT', 'PR_TEAM', 'EVENT_MANAGEMENT', 'MEDIA_LEAD', 'SOCIAL_MEDIA_LEAD'].includes(user.role)],
        [<Icon8 name="idDocs" size={17} />, isMrdu ? 'Organizing Team' : 'Team / Leaders', 'admin-team', has('TEAM_MANAGE') || isSuper || ['VICE_PRESIDENT'].includes(user.role)],
        [<Icon8 name="keySecurity" size={17} />, 'Settings & Links', 'admin-settings', has('SETTINGS_MANAGE') || isSuper],
        [<Icon8 name="showPassword" size={17} />, 'Audit Log', 'admin-audit', has('AUDIT_VIEW') || isSuper],
        [<Icon8 name="fingerprint" size={17} />, 'My Profile', 'admin-profile', true],
        [<Icon8 name="password" size={17} />, 'Security & PIN', 'security', true],
      ].filter(item => item[3])
    : [
        [<Icon8 name="protect" size={17} />, isMrdu ? 'Events Home' : 'Dashboard', 'student-dashboard', true],
        [<Icon8 name="realtime" size={17} />, 'Events Catalog', 'student-events', true],
        [<Icon8 name="faceId" size={17} />, isMrdu ? 'My Event Passes' : 'My Passes', 'student-passes', true],
        [<Icon8 name="realtime" size={17} />, isMrdu ? 'MRDU Reels' : 'Campus Reels', 'student-reels', reelsEnabled],
        [<Icon8 name="access" size={17} />, isMrdu ? 'Student Pass' : 'Membership', 'student-membership', subEnabled],
        [<Icon8 name="captcha" size={17} />, 'Helpdesk & Doubts', 'student-support', true],
        [<Icon8 name="idDocs" size={17} />, isMrdu ? 'Organizing Team' : 'Our Team', 'student-team', true],
        [<Icon8 name="irisScan" size={17} />, isMrdu ? 'Event Gallery' : 'Gallery', 'student-gallery', true],
        [<Icon8 name="fingerprint" size={17} />, 'My Profile', 'student-profile', true],
        [<Icon8 name="password" size={17} />, 'Account Security', 'security', true],
      ].filter(item => item[3])

  return (
    <>
      <div className={`sidebar-overlay ${isOpen ? 'active' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="side-logo">
          <Crest platformMode={platformMode} small />
          <div>
            <strong>{isMrdu ? 'MRDU' : 'CSC'}</strong>
            <small>{isMrdu ? 'EVENTS' : 'MRDU'}</small>
          </div>
        </div>
        <nav>
          {navItems.map(([icon, label, target]) => (
            <button
              key={target}
              type="button"
              className={activeTab === target ? 'active' : ''}
              onClick={() => {
                onNavigate(target)
                if (onClose) onClose()
              }}
            >
              <span className="nav-icon">{icon}</span>
              <span className="nav-label">{label}</span>
            </button>
          ))}
        </nav>
        <div className="side-bottom">
          <button type="button" onClick={logout}>
            <span className="nav-icon"><Icon8 name="access" size={16} /></span>
            <span className="nav-label">Sign out</span>
          </button>
          <small>SECURE SESSION · {user.memberId}</small>
        </div>
      </aside>
    </>
  )
}

function RolePersonaSwitcher({ user, onSwitchRole, onNavigate }) {
  const { onSwitchAccount, onSwitchBackToAdmin } = usePlatformTheme()
  const [open, setOpen] = useState(false)
  const [targetInput, setTargetInput] = useState('')
  const [switching, setSwitching] = useState(false)
  const dropdownRef = useRef(null)

  const activePersona = PERSONA_ROLES.find(r => r.id === user.role) || {
    id: user.role,
    label: getRoleLabel(user.role),
    emoji: '🛡️',
    badge: 'LEAD',
  }

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  async function handleFastSwitch(memberId) {
    if (!memberId || !memberId.trim()) return
    setSwitching(true)
    try {
      if (onSwitchAccount) await onSwitchAccount(memberId.trim())
      setOpen(false)
      setTargetInput('')
    } catch {
    } finally {
      setSwitching(false)
    }
  }

  return (
    <div className="role-persona-switcher-container" ref={dropdownRef}>
      <button
        type="button"
        className="role-persona-trigger"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        title="Click to switch between club roles or switch accounts"
        style={{
          border: user.isImpersonating ? '1.5px solid #f59e0b' : undefined,
          background: user.isImpersonating ? 'rgba(245, 158, 11, 0.15)' : undefined,
        }}
      >
        <span style={{ fontSize: '10px', fontWeight: 800, color: user.isImpersonating ? '#f59e0b' : 'var(--brand-primary)', fontFamily: '"DM Mono", monospace' }}>
          {user.isImpersonating ? 'SWITCHED:' : 'SWITCH:'}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ fontSize: '13px' }}>{activePersona.emoji}</span>
          <span style={{ color: 'var(--text-main)' }}>{user.name?.split(' ')[0] || activePersona.label}</span>
        </span>
        <span style={{ fontSize: '9px', opacity: 0.7, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}>
          ▼
        </span>
      </button>

      {open && (
        <div className="role-persona-dropdown-menu" role="listbox" style={{ width: '290px', maxHeight: '460px' }}>
          {user.isImpersonating && (
            <div style={{ padding: '6px', marginBottom: '8px', background: 'rgba(245, 158, 11, 0.15)', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.4)' }}>
              <div style={{ fontSize: '10px', color: '#fef08a', fontWeight: 700, marginBottom: '4px' }}>
                ⇄ Switched from: {user.originalAdmin?.name || 'Admin'}
              </div>
              <button
                type="button"
                onClick={async () => {
                  setOpen(false)
                  if (onSwitchBackToAdmin) await onSwitchBackToAdmin()
                }}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  background: '#f59e0b',
                  color: '#000',
                  fontWeight: 800,
                  borderRadius: '5px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '11px',
                }}
              >
                ⇄ SWITCH BACK TO ADMIN
              </button>
            </div>
          )}

          <div style={{ padding: '4px 8px', fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.5px', textTransform: 'uppercase', borderBottom: '1px solid var(--line)', marginBottom: '6px' }}>
            Switch Account
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', padding: '0 4px 8px' }}>
            <button
              type="button"
              disabled={switching}
              onClick={() => handleFastSwitch('25EU07R0015')}
              style={{
                padding: '6px 8px',
                borderRadius: '6px',
                border: '1px solid var(--line)',
                background: 'var(--bg-input)',
                color: 'var(--text-main)',
                fontSize: '10.5px',
                fontWeight: 700,
                cursor: 'pointer',
                textAlign: 'left',
              }}
              title="Switch to Primary President (25EU07R0015)"
            >
              👑 President<br/>
              <small style={{ color: 'var(--brand-primary)', fontFamily: 'monospace', fontSize: '9.5px' }}>25EU07R0015</small>
            </button>

            <button
              type="button"
              disabled={switching}
              onClick={() => handleFastSwitch('25EU07R0016')}
              style={{
                padding: '6px 8px',
                borderRadius: '6px',
                border: '1px solid var(--line)',
                background: 'var(--bg-input)',
                color: 'var(--text-main)',
                fontSize: '10.5px',
                fontWeight: 700,
                cursor: 'pointer',
                textAlign: 'left',
              }}
              title="Switch to Student Coordinator (25EU07R0016)"
            >
              🎓 Coordinator<br/>
              <small style={{ color: 'var(--brand-primary)', fontFamily: 'monospace', fontSize: '9.5px' }}>25EU07R0016</small>
            </button>
          </div>

          <form onSubmit={e => { e.preventDefault(); handleFastSwitch(targetInput) }} style={{ display: 'flex', gap: '4px', padding: '0 4px 8px', borderBottom: '1px solid var(--line)' }}>
            <input
              type="text"
              placeholder="Roll No or Member ID"
              value={targetInput}
              onChange={e => setTargetInput(e.target.value.toUpperCase())}
              style={{ flex: 1, height: '28px', padding: '0 8px', fontSize: '11px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '4px', color: 'var(--text-main)', fontFamily: 'monospace' }}
            />
            <button
              type="submit"
              disabled={switching || !targetInput.trim()}
              style={{ height: '28px', padding: '0 10px', fontSize: '11px', fontWeight: 800, background: 'var(--brand-primary)', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              {switching ? '…' : '⇄ Go'}
            </button>
          </form>

          <div style={{ padding: '6px 8px 4px', fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '4px' }}>
            Switch Role Persona
          </div>
          {PERSONA_ROLES.map(r => {
            const isSelected = r.id === user.role
            return (
              <button
                key={r.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`role-persona-item ${isSelected ? 'selected' : ''}`}
                onClick={() => {
                  setOpen(false)
                  if (onSwitchRole) onSwitchRole(r.id)
                  if (onNavigate) {
                    onNavigate(r.id === 'STUDENT' ? 'student-dashboard' : (r.id === 'STUDENT_COORDINATOR' ? 'admin-coordinator' : 'admin-dashboard'))
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '14px' }}>{r.emoji}</span>
                  <span style={{ fontWeight: isSelected ? 700 : 600 }}>{r.label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 5px', borderRadius: '4px', background: isSelected ? 'var(--brand-primary)' : 'var(--panel-subtle)', color: isSelected ? '#000' : 'var(--text-dim)', border: '1px solid var(--line)' }}>
                    {r.badge}
                  </span>
                  {isSelected && <span style={{ color: 'var(--brand-primary)', fontWeight: 800 }}>✓</span>}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Header({ user, title, onProfile, onToggleNav, onOpenNotifications, unreadCount, onSwitchPersonaRole, onNavigate }) {
  const { platformMode, themeMode, setThemeMode, onSwitchPersonaRole: ctxSwitchPersona } = usePlatformTheme()
  const isMrdu = platformMode === 'MRDU_EVENTS'

  const effectiveSwitchPersona = onSwitchPersonaRole || ctxSwitchPersona

  function cycleTheme() {
    if (themeMode === 'dark') setThemeMode('light')
    else if (themeMode === 'light') setThemeMode('system')
    else setThemeMode('dark')
  }

  const ThemeIconComponent = themeMode === 'light' ? IconSun : themeMode === 'dark' ? IconMoon : IconMonitor
  const themeLabel = themeMode === 'light' ? 'Light' : themeMode === 'dark' ? 'Dark' : 'System'

  return (
    <header className="header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <button type="button" className="mobile-nav-toggle" onClick={onToggleNav} aria-label="Toggle navigation menu">
          ☰
        </button>
        <div>
          <b>{title || (user.isAdminUser ? getRoleLabel(user.role).toUpperCase() : (isMrdu ? 'MRDU PARTICIPANT PORTAL' : 'STUDENT MEMBER PORTAL'))}</b>
          <small>{isMrdu ? 'MALLA REDDY (DEEMED TO BE UNIVERSITY) · CENTRAL EVENTS' : 'CYBER SECURITY CLUB · MRDU'}</small>
        </div>
      </div>
      <div className="header-tools" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Dynamic Role Switcher for Student Coordinator / Multi-Role Leads */}
        {user.canSwitchPersona && (
          <RolePersonaSwitcher
            user={user}
            onSwitchRole={effectiveSwitchPersona}
            onNavigate={onNavigate}
          />
        )}

        {/* Quick Theme Toggle Right At The Top */}
        <button
          type="button"
          className="quick-theme-toggle"
          onClick={cycleTheme}
          title={`Theme: ${themeMode.toUpperCase()} (Click to toggle)`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '6px 12px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)', cursor: 'pointer' }}
        >
          <ThemeIconComponent size={14} />
          <span>{themeLabel}</span>
        </button>

        {/* In-App Notifications Bell */}
        <button
          type="button"
          className="notification-bell-btn"
          onClick={onOpenNotifications}
          aria-label="View notifications"
          title="Notifications & Updates"
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <IconBell size={16} />
          {unreadCount > 0 && <span className="notification-badge-count">{unreadCount}</span>}
        </button>

        {/* Profile Pill */}
        {onProfile && (
          <button
            type="button"
            className="profile profile-button"
            onClick={onProfile}
            aria-label="Open profile"
            style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-input)', padding: '5px 12px', borderRadius: '8px', border: '1px solid var(--line)', cursor: 'pointer' }}
          >
            {user.profile?.profileImage ? (
              <img
                src={user.profile.profileImage}
                alt={user.name}
                style={{ width: '32px', height: '32px', borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--brand-border-subtle)' }}
              />
            ) : (
              <span style={{ width: '32px', height: '32px', borderRadius: '6px', background: 'var(--brand-gradient)', display: 'grid', placeItems: 'center', color: 'var(--brand-text)', font: '700 11px Syne' }}>
                {user.initials}
              </span>
            )}
            <div style={{ textAlign: 'left' }}>
              <b style={{ color: 'var(--text-main)', fontSize: '11px', display: 'block' }}>{user.name}</b>
              <small style={{ color: 'var(--brand-eyebrow)', font: '500 9px "DM Mono", monospace', display: 'block' }}>
                {user.isPrimaryAdmin ? 'Primary President' : `${getRoleLabel(user.role)} · ${user.memberId}`}
              </small>
            </div>
          </button>
        )}
      </div>
    </header>
  )
}

function NotificationsModal({ isOpen, onClose, onNavigate }) {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    memberApi.listNotifications()
      .then(res => setNotifications(res.notifications || []))
      .finally(() => setLoading(false))
  }, [isOpen])

  async function handleMarkAll() {
    await memberApi.markAllNotificationsRead()
    setNotifications(c => c.map(n => ({ ...n, isRead: true })))
  }

  async function handleClickNotification(n) {
    if (!n.isRead) {
      await memberApi.markNotificationRead(n.id)
    }
    onClose()
    if (n.linkUrl) {
      const cleanPath = n.linkUrl.replace(/^\//, '')
      onNavigate(cleanPath)
    }
  }

  if (!isOpen) return null

  return (
    <div className="photo-lightbox" onClick={onClose}>
      <div className="photo-lightbox-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px', width: '100%', background: 'var(--bg-modal)', padding: '24px', borderRadius: '14px', border: '1px solid var(--line)', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--line)', paddingBottom: '12px', marginBottom: '14px' }}>
          <div>
            <h3 style={{ margin: 0, font: '700 18px Syne', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icon8 name="idDocs" size={16} /> Notifications & Alerts
            </h3>
            <small style={{ color: 'var(--text-muted)' }}>Updates on events, subscriptions, and support replies</small>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button type="button" className="action-btn edit-btn" onClick={handleMarkAll} style={{ fontSize: '10px' }}>Mark all read</button>
            <button className="lightbox-close" onClick={onClose} style={{ position: 'static' }}>✕</button>
          </div>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
          {loading ? (
            <p className="directory-state">Loading messages...</p>
          ) : notifications.length === 0 ? (
            <p className="directory-state">No notifications recorded yet.</p>
          ) : (
            notifications.map(n => (
              <div
                key={n.id}
                className={`notification-item ${n.isRead ? 'read' : 'unread'}`}
                onClick={() => handleClickNotification(n)}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  marginBottom: '8px',
                  background: n.isRead ? 'var(--bg-input)' : 'var(--brand-badge-bg)',
                  border: n.isRead ? '1px solid var(--line)' : '1px solid var(--brand-border-subtle)',
                  cursor: n.linkUrl ? 'pointer' : 'default',
                  transition: 'background 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <b style={{ color: 'var(--text-main)', fontSize: '13px' }}>{n.title}</b>
                  <small style={{ color: 'var(--text-dim)', fontSize: '10px' }}>
                    {n.createdAt ? new Date(n.createdAt).toLocaleDateString() : ''}
                  </small>
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>{n.message}</p>
                {n.linkUrl && (
                  <small style={{ color: 'var(--brand-primary)', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '6px', fontWeight: 600 }}>
                    Open link →
                  </small>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function LivePortal({ user, logout, activeTab, onNavigate, title, onUserUpdated, onSwitchPersonaRole, children }) {
  const [navOpen, setNavOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    let mounted = true
    memberApi.listNotifications()
      .then(res => { if (mounted) setUnreadCount(res.unreadCount || 0) })
      .catch(() => {})
    return () => { mounted = false }
  }, [activeTab])

  return (
    <main className="portal">
      <Sidebar
        user={user}
        logout={logout}
        activeTab={activeTab}
        onNavigate={onNavigate}
        isOpen={navOpen}
        onClose={() => setNavOpen(false)}
      />
      <div className="workspace">
        <Header
          user={user}
          title={title}
          onProfile={() => onNavigate(user.isAdminUser ? 'admin-profile' : 'student-profile')}
          onToggleNav={() => setNavOpen(o => !o)}
          onOpenNotifications={() => setNotifOpen(true)}
          unreadCount={unreadCount}
          onSwitchPersonaRole={onSwitchPersonaRole}
          onNavigate={onNavigate}
        />
        <div className="dashboard">{children}</div>
      </div>

      <NotificationsModal
        isOpen={notifOpen}
        onClose={() => {
          setNotifOpen(false)
          memberApi.listNotifications().then(res => setUnreadCount(res.unreadCount || 0)).catch(() => {})
        }}
        onNavigate={onNavigate}
      />
    </main>
  )
}

// ----------------------------------------------------
// Login & Auth Recovery Screens
// ----------------------------------------------------
function GuestRegisterModal({ isOpen, onClose, onSuccess }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [gender, setGender] = useState('MALE')
  const [age, setAge] = useState(19)
  const [year, setYear] = useState(1)
  const [collegeChoice, setCollegeChoice] = useState('Malla Reddy (MR) Deemed to be University, Maisammaguda, Hyderabad')
  const [customCollege, setCustomCollege] = useState('')
  const [branch, setBranch] = useState('CSE')
  const [specialization, setSpecialization] = useState('AIML')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!isOpen) return null

  const isCustomCollege = collegeChoice === 'Other / External University (Specify Below)' || collegeChoice === 'Other'
  const effectiveCollege = isCustomCollege ? customCollege.trim() : collegeChoice

  async function handleRegister(e) {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Please enter your full name.')
      return
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.')
      return
    }
    if (isCustomCollege && !customCollege.trim()) {
      setError('Please enter your college name.')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        name: name.trim(),
        email: email.trim(),
        gender,
        age: age ? Number(age) : null,
        year: year ? Number(year) : 1,
        college: effectiveCollege,
        branch,
        specialization: branch === 'CSE' ? specialization : null,
      }

      const res = await authApi.registerGuest(payload)
      // Automatically download official ID Pass.png
      await downloadIdPass({
        name: payload.name,
        college: payload.college,
        branch: payload.branch,
        year: payload.year,
        specialization: payload.specialization,
        memberId: res.memberId,
        password: res.password,
      })

      onSuccess({
        name: payload.name,
        college: payload.college,
        branch: payload.branch,
        year: payload.year,
        specialization: payload.specialization,
        memberId: res.memberId,
        password: res.password,
      })
    } catch (err) {
      setError(err.message || 'Unable to create guest account. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="photo-lightbox" onClick={onClose}>
      <div className="guest-modal-content" onClick={e => e.stopPropagation()}>
        <button className="lightbox-close" onClick={onClose}>✕</button>
        
        <div style={{ textAlign: 'center', marginBottom: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Crest small />
          <span className="badge badge-registered" style={{ margin: '12px auto 6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            STUDENT PORTAL REGISTRATION
          </span>
          <h2 style={{ font: '700 22px Syne', color: 'var(--text-main)', margin: '4px 0 4px' }}>
            Create Student Account
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: 0 }}>
            Guest & External Student Portal Access · MRDU & Partner Colleges
          </p>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid #ef444455', color: '#fca5a5', fontSize: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }} role="alert">
            <IconAlertTriangle size={14} /> {error}
          </div>
        )}

        <form onSubmit={handleRegister}>
          <div className="guest-field-group">
            <label>Full Name *</label>
            <input
              required
              placeholder="e.g. Rahul Sharma"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          <div className="guest-field-group">
            <label>Official Email Address *</label>
            <input
              type="email"
              required
              placeholder="e.g. rahul.sharma@gmail.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div className="guest-field-group" style={{ margin: 0 }}>
              <label>Gender *</label>
              <select
                value={gender}
                onChange={e => setGender(e.target.value)}
              >
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other / Non-Binary</option>
              </select>
            </div>
            <div className="guest-field-group" style={{ margin: 0 }}>
              <label>Age *</label>
              <input
                type="number"
                min="15"
                max="60"
                required
                placeholder="19"
                value={age}
                onChange={e => setAge(e.target.value)}
              />
            </div>
          </div>

          <div className="guest-field-group">
            <label>College / Institution Name *</label>
            <select
              value={collegeChoice}
              onChange={e => setCollegeChoice(e.target.value)}
            >
              {OFFICIAL_COLLEGES_LIST.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {isCustomCollege && (
            <div className="guest-field-group">
              <label>Enter College / University Name *</label>
              <input
                required
                placeholder="e.g. JNTU Hyderabad / Osmania University"
                value={customCollege}
                onChange={e => setCustomCollege(e.target.value)}
              />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div className="guest-field-group" style={{ margin: 0 }}>
              <label>Academic Year *</label>
              <select
                value={year}
                onChange={e => setYear(Number(e.target.value))}
              >
                {ACADEMIC_YEARS.map(y => (
                  <option key={y.value} value={y.value}>{y.label}</option>
                ))}
              </select>
            </div>

            <div className="guest-field-group" style={{ margin: 0 }}>
              <label>Branch / Department *</label>
              <select
                value={branch}
                onChange={e => setBranch(e.target.value)}
              >
                {BRANCH_OPTIONS.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          </div>

          {branch === 'CSE' && (
            <div className="guest-field-group">
              <label>CSE Specialization *</label>
              <select
                value={specialization}
                onChange={e => setSpecialization(e.target.value)}
              >
                {CSE_SPECIALIZATIONS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ background: 'var(--panel-subtle)', border: '1px solid var(--line)', borderRadius: '8px', padding: '12px', margin: '16px 0', fontSize: '11px', color: 'var(--brand-primary)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
              <IconShieldCheck size={14} /> Automated Credentials & ID Pass Generation:
            </span>
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              Your unique <b>Guest Member ID</b> (e.g. <code>GUEST2026001</code>) and a <b>14-character secure password</b> will be automatically generated. An official <b>ID Pass.png</b> will be downloaded directly to your device.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button
              type="button"
              className="action-btn"
              onClick={onClose}
              style={{ flex: 1, height: '42px', background: 'var(--panel-elevated)', color: 'var(--text-main)', border: '1px solid var(--line)' }}
            >
              CANCEL
            </button>
            <button
              type="submit"
              className="primary"
              disabled={submitting}
              style={{ flex: 2, height: '42px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              {submitting ? 'GENERATING ID PASS…' : <><IconSparkles size={13} /> CREATE ACCOUNT & DOWNLOAD PASS</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function GuestCredentialsSuccessModal({ data, onClose, onProceedToLogin }) {
  if (!data) return null

  return (
    <div className="photo-lightbox">
      <div className="guest-modal-content" style={{ textAlign: 'center', maxWidth: '520px' }}>
        <span style={{ display: 'inline-flex', padding: '14px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', marginBottom: '12px' }}>
          <IconShieldCheck size={36} />
        </span>
        <h2 style={{ color: 'var(--text-main)', font: '700 22px Syne', margin: '0 0 4px' }}>
          Account Created Successfully!
        </h2>
        <p style={{ color: '#059669', fontSize: '12px', fontWeight: 600, margin: '0 0 16px' }}>
          ✓ Official ID Pass.png has been automatically downloaded to your device
        </p>

        <div className="guest-credentials-card">
          <div className="cred-row">
            <span className="cred-label">STUDENT NAME</span>
            <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{data.name}</span>
          </div>
          <div className="cred-row">
            <span className="cred-label">COLLEGE / INSTITUTION</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{data.college}</span>
          </div>
          <div className="cred-row">
            <span className="cred-label">ACADEMIC YEAR</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
              {ACADEMIC_YEARS.find(y => y.value === Number(data.year))?.label || `Year ${data.year || 1}`}
            </span>
          </div>
          <div className="cred-row">
            <span className="cred-label">BRANCH</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{data.branch}{data.specialization ? ` (${data.specialization})` : ''}</span>
          </div>
          <div className="cred-row">
            <span className="cred-label">MEMBER ID (USERNAME)</span>
            <span className="cred-value">{data.memberId}</span>
          </div>
          <div className="cred-row">
            <span className="cred-label">GENERATED PASSWORD</span>
            <span className="cred-value" style={{ color: '#059669', border: '1px solid rgba(5, 150, 105, 0.3)' }}>{data.password}</span>
          </div>
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: '11px', lineHeight: '1.5', margin: '0 0 20px' }}>
          Please keep an offline copy of your credentials. You can use this Member ID and Password to sign in to the portal anytime.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            type="button"
            className="action-btn"
            onClick={() => downloadIdPass(data)}
            style={{ width: '100%', height: '40px', background: 'var(--panel-elevated)', color: 'var(--brand-primary)', border: '1px solid var(--brand-border-subtle)', fontSize: '11px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            <IconDownload size={13} /> DOWNLOAD ID PASS.PNG AGAIN
          </button>
          <button
            type="button"
            className="primary"
            onClick={onProceedToLogin}
            style={{ width: '100%', height: '44px', fontSize: '11px' }}
          >
            PROCEED TO LOGIN →
          </button>
        </div>
      </div>
    </div>
  )
}

function ForgotPasswordModal({ isOpen, onClose }) {
  const [copied, setCopied] = useState(false)
  if (!isOpen) return null

  function handleCopy() {
    navigator.clipboard?.writeText('cybersecurityclub@mrdu.edu').then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    }).catch(() => {})
  }

  return (
    <div className="photo-lightbox" onClick={onClose}>
      <div className="guest-modal-content" onClick={e => e.stopPropagation()} style={{ textAlign: 'center', maxWidth: '480px' }}>
        <button className="lightbox-close" onClick={onClose}>✕</button>
        <span style={{ display: 'inline-flex', padding: '14px', borderRadius: '50%', background: 'var(--brand-badge-bg)', color: 'var(--brand-primary)', marginBottom: '12px' }}>
          <IconHeadset size={32} />
        </span>
        <h2 style={{ color: 'var(--text-main)', font: '700 20px Syne', margin: '0 0 6px' }}>
          Account Recovery & Support
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.6', margin: '0 0 20px' }}>
          For account recovery, password reset, or credential lookup, please reach out to the Club Executive Team or visit the Department Office with your College ID.
        </p>

        <div style={{ background: 'var(--panel-subtle)', border: '1px solid var(--line)', borderRadius: '10px', padding: '14px', marginBottom: '20px', textAlign: 'left' }}>
          <small style={{ color: 'var(--text-dim)', fontSize: '10px', fontWeight: 700, display: 'block', textTransform: 'uppercase' }}>OFFICIAL HELPDESK EMAIL</small>
          <code style={{ fontSize: '13px', color: 'var(--brand-primary)', display: 'block', marginTop: '4px', wordBreak: 'break-all' }}>cybersecurityclub@mrdu.edu</code>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className="action-btn"
            onClick={handleCopy}
            style={{ flex: 1, height: '42px', background: 'var(--panel-elevated)', color: 'var(--brand-primary)', border: '1px solid var(--brand-border-subtle)', fontSize: '11px', fontWeight: 600 }}
          >
            {copied ? '✓ COPIED TO CLIPBOARD' : 'COPY EMAIL ADDRESS'}
          </button>
          <button
            type="button"
            className="primary"
            onClick={onClose}
            style={{ flex: 1, height: '42px', fontSize: '11px' }}
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  )
}

function FinalLogin({ onSignIn, onForgotPassword }) {
  const [error, setError] = useState('')
  const [errorCode, setErrorCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [memberIdVal, setMemberIdVal] = useState('')
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [showForgotModal, setShowForgotModal] = useState(false)
  const [guestSuccessData, setGuestSuccessData] = useState(null)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [publicEvents, setPublicEvents] = useState([])

  const { platformMode, themeMode, setThemeMode } = usePlatformTheme()
  const isMrdu = platformMode === 'MRDU_EVENTS'

  function cycleTheme() {
    if (themeMode === 'dark') setThemeMode('light')
    else if (themeMode === 'light') setThemeMode('system')
    else setThemeMode('dark')
  }

  const ThemeIconComponent = themeMode === 'light' ? IconSun : themeMode === 'dark' ? IconMoon : IconMonitor
  const themeLabel = themeMode === 'light' ? 'Light' : themeMode === 'dark' ? 'Dark' : 'System'

  // Cursor-reactive grid
  const showcaseRef = useRef(null)
  const handleShowcaseMouseMove = useCallback((e) => {
    const el = showcaseRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const pctX = (x / rect.width) * 100
    const pctY = (y / rect.height) * 100
    // Grid parallax offset (subtle, ±8px)
    const ox = ((x / rect.width) - 0.5) * 16
    const oy = ((y / rect.height) - 0.5) * 16
    el.style.setProperty('--gx', `${pctX}%`)
    el.style.setProperty('--gy', `${pctY}%`)
    el.style.setProperty('--ox', `${ox}px`)
    el.style.setProperty('--oy', `${oy}px`)
  }, [])
  const handleShowcaseMouseLeave = useCallback(() => {
    const el = showcaseRef.current
    if (!el) return
    el.style.setProperty('--gx', '50%')
    el.style.setProperty('--gy', '40%')
    el.style.setProperty('--ox', '0px')
    el.style.setProperty('--oy', '0px')
  }, [])

  // Interactive Login Card Dynamic Spotlight
  const loginCardRef = useRef(null)
  const handleCardMouseMove = useCallback((e) => {
    const el = loginCardRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const pctX = (x / rect.width) * 100
    const pctY = (y / rect.height) * 100
    el.style.setProperty('--card-x', `${pctX}%`)
    el.style.setProperty('--card-y', `${pctY}%`)
  }, [])
  const handleCardMouseLeave = useCallback(() => {
    const el = loginCardRef.current
    if (!el) return
    el.style.setProperty('--card-x', '50%')
    el.style.setProperty('--card-y', '30%')
  }, [])

  useEffect(() => {
    if (isMrdu) {
      authApi.getPublicEvents()
        .then(res => setPublicEvents(res.events || []))
        .catch(() => {})
    }
  }, [isMrdu])

  async function submit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const memberId = String(form.get('memberId') || '').trim().toUpperCase()
    const password = String(form.get('password') || '')
    if (!/^[A-Z0-9]{5,32}$/.test(memberId) || password.length < 12) {
      setError('Enter a valid Member ID and password (12+ characters).')
      setErrorCode('')
      return
    }
    setError('')
    setErrorCode('')
    setLoading(true)
    try {
      await onSignIn(memberId, password)
    } catch (requestError) {
      setError(requestError.message || 'Unable to sign in.')
      setErrorCode(requestError.code || '')
    } finally {
      setLoading(false)
    }
  }

  const isAccountDisabled = errorCode === 'ACCOUNT_DISABLED' || error.toLowerCase().includes('disabled') || error.toLowerCase().includes('technical team')

  if (isMrdu) {
    return (
      <main className="mrdu-landing-wrapper">
        <MrduOfficialLanding
          onOpenAuth={() => setShowLoginModal(true)}
          onOpenRegister={() => setShowRegisterModal(true)}
          events={publicEvents}
        />

        {/* Modal for Portal Sign In */}
        {showLoginModal && (
          <div
            className="modal-backdrop"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(7, 22, 44, 0.75)',
              backdropFilter: 'blur(8px)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
            }}
            onClick={() => setShowLoginModal(false)}
          >
            <div
              className="login-card"
              style={{
                maxWidth: '460px',
                width: '100%',
                background: '#ffffff',
                border: '1px solid rgba(11, 30, 54, 0.15)',
                borderRadius: '20px',
                padding: '36px 32px',
                boxShadow: '0 24px 60px rgba(0, 0, 0, 0.3)',
                position: 'relative',
              }}
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => setShowLoginModal(false)}
                style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '14px',
                  color: '#475569',
                }}
              >
                ✕
              </button>

              <div style={{ textAlign: 'center', marginBottom: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Crest platformMode={platformMode} small />
                <span className="badge badge-president" style={{ marginTop: '12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#fff7ed', color: '#ea580c', border: '1px solid rgba(234, 88, 12, 0.2)' }}>
                  OFFICIAL UNIVERSITY ACCESS
                </span>
                <h2 style={{ font: '800 24px "Plus Jakarta Sans", sans-serif', color: '#0b1e36', margin: '10px 0 4px' }}>Sign in to Portal</h2>
                <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
                  Enter your university credentials to access events & passes.
                </p>
              </div>

              <form onSubmit={submit} noValidate>
                <div className="login-field-group">
                  <label htmlFor="modal-member-id" style={{ color: '#0b1e36', fontWeight: 600 }}>Member / Student ID</label>
                  <div className="login-input-wrapper">
                    <span className="login-input-icon" style={{ color: '#64748b' }}><IconUserSvg size={14} /></span>
                    <input
                      id="modal-member-id"
                      name="memberId"
                      required
                      maxLength={32}
                      pattern="[A-Za-z0-9]+"
                      autoComplete="username"
                      placeholder="e.g. 25EU07R0015"
                      value={memberIdVal}
                      onChange={e => setMemberIdVal(e.target.value.toUpperCase())}
                      style={{ color: '#0f172a', background: '#f8fafc', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                </div>

                <div className="login-field-group">
                  <label htmlFor="modal-password" style={{ color: '#0b1e36', fontWeight: 600 }}>Account Password</label>
                  <div className="login-input-wrapper">
                    <span className="login-input-icon" style={{ color: '#64748b' }}><Icon8 name="password" size={14} /></span>
                    <input
                      id="modal-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={12}
                      maxLength={128}
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      style={{ color: '#0f172a', background: '#f8fafc', border: '1px solid #cbd5e1' }}
                    />
                    <button
                      type="button"
                      className="login-pwd-toggle"
                      onClick={() => setShowPassword(p => !p)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      <Icon8 name="showPassword" size={15} />
                    </button>
                  </div>
                </div>

                {error && (
                  <div
                    style={{
                      padding: '14px 16px',
                      borderRadius: '10px',
                      background: isAccountDisabled ? '#fef2f2' : 'rgba(239, 68, 68, 0.12)',
                      border: isAccountDisabled ? '1.5px solid #f87171' : '1px solid #ef444455',
                      color: isAccountDisabled ? '#991b1b' : '#b91c1c',
                      fontSize: '12px',
                      marginBottom: '16px',
                      lineHeight: '1.55',
                    }}
                    role="alert"
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <span style={{ color: '#dc2626', flexShrink: 0, marginTop: '2px' }}><IconAlertTriangle size={18} /></span>
                      <div>
                        <b style={{ color: '#dc2626', display: 'block', fontSize: '13px', fontWeight: 800, marginBottom: '3px', letterSpacing: '0.02em' }}>
                          {isAccountDisabled ? 'ACCOUNT ACCESS DISABLED' : 'AUTHENTICATION FAILED'}
                        </b>
                        <span>{error}</span>
                        {isAccountDisabled && (
                          <div style={{ marginTop: '10px' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setShowLoginModal(false)
                                setShowForgotModal(true)
                              }}
                              style={{
                                background: '#dc2626',
                                color: '#ffffff',
                                border: 'none',
                                padding: '6px 12px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                              }}
                            >
                              <IconLifebuoy size={13} /> Contact Technical Helpdesk ➔
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <button
                  className="primary"
                  disabled={loading}
                  style={{
                    width: '100%',
                    minHeight: '46px',
                    fontSize: '12px',
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, #ff5722, #dc2626)',
                    boxShadow: '0 4px 16px rgba(255, 87, 34, 0.35)',
                    borderRadius: '10px',
                  }}
                >
                  {loading ? 'AUTHENTICATING SECURE SESSION…' : 'SIGN IN TO UNIVERSITY PORTAL ➔'}
                </button>
              </form>

              <div className="login-footer-links" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '18px' }}>
                <button
                  className="back-button"
                  type="button"
                  onClick={() => {
                    setShowLoginModal(false)
                    setShowRegisterModal(true)
                  }}
                  style={{ margin: 0, fontSize: '12px', color: '#ff5722', fontWeight: 700 }}
                >
                  Register as Guest
                </button>
                <span style={{ color: '#cbd5e1', fontSize: '12px' }}>|</span>
                <button
                  className="back-button"
                  type="button"
                  onClick={() => {
                    setShowLoginModal(false)
                    setShowForgotModal(true)
                  }}
                  style={{ margin: 0, fontSize: '12px', color: '#475569' }}
                >
                  Forgot Password?
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Guest Student Registration Modal */}
        {showRegisterModal && (
          <GuestRegisterModal
            isOpen={showRegisterModal}
            onClose={() => setShowRegisterModal(false)}
            onSuccess={data => {
              setShowRegisterModal(false)
              setGuestSuccessData(data)
            }}
          />
        )}

        {/* Auto-Downloaded Credentials Confirmation Modal */}
        {guestSuccessData && (
          <GuestCredentialsSuccessModal
            data={guestSuccessData}
            onClose={() => setGuestSuccessData(null)}
            onProceedToLogin={() => {
              setMemberIdVal(guestSuccessData.memberId)
              setGuestSuccessData(null)
              setShowLoginModal(true)
            }}
          />
        )}

        {/* Forgot Password / Support Modal */}
        {showForgotModal && (
          <ForgotPasswordModal
            isOpen={showForgotModal}
            onClose={() => setShowForgotModal(false)}
          />
        )}
      </main>
    )
  }

  return (
    <main className="login-page">
      <section
        className="login-showcase"
        ref={showcaseRef}
        onMouseMove={handleShowcaseMouseMove}
        onMouseLeave={handleShowcaseMouseLeave}
        style={{
          '--gx': '50%',
          '--gy': '40%',
          '--ox': '0px',
          '--oy': '0px',
        }}
      >
        <div className="grid-overlay" />
        <div className="login-showcase-spotlight" />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--brand-eyebrow)', font: '600 10px "DM Mono", monospace', letterSpacing: '.12em', zIndex: 2 }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--brand-accent)', boxShadow: '0 0 10px var(--brand-accent)', display: 'inline-block' }} />
          {isMrdu ? 'MALLA REDDY (DEEMED TO BE UNIVERSITY) · NAAC A++' : 'OFFICIAL STUDENT COMMUNITY · MRDU'}
        </div>

        <div style={{ position: 'relative', zIndex: 2, maxWidth: '560px', margin: '40px 0' }}>
          <Crest platformMode={platformMode} showBanner={isMrdu} />
          <div style={{ marginTop: '28px' }}>
            <p className="eyebrow">{isMrdu ? 'MALLA REDDY UNIVERSITY' : 'DEPARTMENT OF CYBER SECURITY'}</p>
            <h1 style={{ font: '800 clamp(32px, 4vw, 54px)/1.08 Syne', color: 'var(--text-main)', margin: '8px 0 16px', letterSpacing: '-.04em' }}>
              {isMrdu ? (
                <>
                  Empowering innovation.<br />
                  <em style={{ color: 'var(--brand-primary)', fontStyle: 'normal' }}>Central Events Portal.</em>
                </>
              ) : (
                <>
                  Defend the digital frontier.<br />
                  <em style={{ color: 'var(--brand-primary)', fontStyle: 'normal' }}>Empower tomorrow.</em>
                </>
              )}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.7', margin: 0 }}>
              {isMrdu
                ? 'The official university gateway for students, faculty, and participants across all departments to register for events, workshops, hackathons, and technical symposiums.'
                : 'The official hub for student cybersecurity operations, ethical hacking sandboxes, live CTFs, and certified technical workshops.'}
            </p>
          </div>
        </div>

        <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '10px', width: 'fit-content' }}>
          <span style={{ color: 'var(--brand-accent)', display: 'inline-flex' }}>{isMrdu ? <IconSparkles size={16} /> : <IconShieldCheck size={16} />}</span>
          <div>
            <b style={{ color: 'var(--text-main)', fontSize: '11px', display: 'block' }}>{isMrdu ? 'MRDU EVENTS CENTRAL PORTAL' : 'CYBER SECURITY CLUB PORTAL'}</b>
            <small style={{ color: 'var(--text-dim)', font: '500 9px "DM Mono", monospace' }}>{isMrdu ? 'OFFICIAL UNIVERSITY EVENT SYSTEM · ALL CAMPUSES' : 'OFFICIAL STUDENT & FACULTY ACCESS · MRDU'}</small>
          </div>
        </div>
      </section>

      <section className="login-panel" style={{ position: 'relative' }}>
        <button
          type="button"
          className="quick-theme-toggle"
          onClick={cycleTheme}
          title={`Theme: ${themeMode.toUpperCase()} (Click to toggle)`}
          style={{ position: 'absolute', top: '18px', right: '22px', zIndex: 10, display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '6px 12px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)', cursor: 'pointer' }}
        >
          <ThemeIconComponent size={14} />
          <span>{themeLabel}</span>
        </button>
        <div
          className="login-card"
          ref={loginCardRef}
          onMouseMove={handleCardMouseMove}
          onMouseLeave={handleCardMouseLeave}
          style={{
            '--card-x': '50%',
            '--card-y': '30%',
          }}
        >
          <div className="login-card-spotlight" />
          <div className="login-card-header">
            <div className="login-card-mobile-crest">
              <Crest platformMode={platformMode} small />
            </div>
            <span className="badge badge-president" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto' }}>
              {isMrdu ? 'SECURE PARTICIPANT ACCESS' : 'SECURE MEMBER ACCESS'}
            </span>
            <h2 style={{ font: '700 24px Syne', color: 'var(--text-main)', margin: '0 0 6px 0' }}>Sign in to Portal</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: 0 }}>
              Enter your authorized Member ID and password.
            </p>
          </div>

          <form onSubmit={submit} noValidate>
            <div className="login-field-group">
              <label htmlFor="final-member-id">Member ID</label>
              <div className="login-input-wrapper">
                <span className="login-input-icon"><IconUserSvg size={14} /></span>
                <input
                  id="final-member-id"
                  name="memberId"
                  required
                  maxLength={32}
                  pattern="[A-Za-z0-9]+"
                  autoComplete="username"
                  placeholder="e.g. CSC2026M01"
                  value={memberIdVal}
                  onChange={e => setMemberIdVal(e.target.value.toUpperCase())}
                />
              </div>
            </div>

            <div className="login-field-group">
              <label htmlFor="final-password">Account Password</label>
              <div className="login-input-wrapper">
                <span className="login-input-icon"><Icon8 name="password" size={14} /></span>
                <input
                  id="final-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={12}
                  maxLength={128}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  className="login-pwd-toggle"
                  onClick={() => setShowPassword(p => !p)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Icon8 name="showPassword" size={15} />
                </button>
              </div>
            </div>

            {error && (
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: '10px',
                  background: isAccountDisabled ? 'rgba(239, 68, 68, 0.16)' : 'rgba(239, 68, 68, 0.12)',
                  border: isAccountDisabled ? '1.5px solid rgba(239, 68, 68, 0.5)' : '1px solid #ef444455',
                  color: '#fca5a5',
                  fontSize: '12px',
                  marginBottom: '16px',
                  lineHeight: '1.55',
                }}
                role="alert"
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <span style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }}><IconAlertTriangle size={18} /></span>
                  <div>
                    <b style={{ color: '#ef4444', display: 'block', fontSize: '13px', fontWeight: 800, marginBottom: '3px', letterSpacing: '0.02em' }}>
                      {isAccountDisabled ? 'ACCOUNT ACCESS DISABLED' : 'AUTHENTICATION FAILED'}
                    </b>
                    <span>{error}</span>
                    {isAccountDisabled && (
                      <div style={{ marginTop: '10px' }}>
                        <button
                          type="button"
                          onClick={() => setShowForgotModal(true)}
                          style={{
                            background: '#dc2626',
                            color: '#ffffff',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <IconLifebuoy size={13} /> Contact Technical Helpdesk ➔
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <button className="primary" disabled={loading} style={{ width: '100%', minHeight: '46px', fontSize: '11px' }}>
              {loading ? 'AUTHENTICATING SECURE SESSION…' : 'AUTHENTICATE & SIGN IN →'}
            </button>
          </form>

          <div className="login-footer-links" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
            <button
              className="back-button"
              type="button"
              onClick={() => setShowRegisterModal(true)}
              style={{ margin: 0, fontSize: '11px', color: '#85d7ff', fontWeight: 600 }}
            >
              Create Account
            </button>
            <span style={{ color: '#334b60', fontSize: '12px' }}>|</span>
            <button
              className="back-button"
              type="button"
              onClick={() => setShowForgotModal(true)}
              style={{ margin: 0, fontSize: '11px' }}
            >
              Forgot Password?
            </button>
          </div>
        </div>
      </section>

      {/* Guest Student Registration Modal */}
      {showRegisterModal && (
        <GuestRegisterModal
          isOpen={showRegisterModal}
          onClose={() => setShowRegisterModal(false)}
          onSuccess={data => {
            setShowRegisterModal(false)
            setGuestSuccessData(data)
          }}
        />
      )}

      {/* Auto-Downloaded Credentials Confirmation Modal */}
      {guestSuccessData && (
        <GuestCredentialsSuccessModal
          data={guestSuccessData}
          onClose={() => setGuestSuccessData(null)}
          onProceedToLogin={() => {
            setMemberIdVal(guestSuccessData.memberId)
            setGuestSuccessData(null)
          }}
        />
      )}

      {/* Forgot Password / Support Modal */}
      {showForgotModal && (
        <ForgotPasswordModal
          isOpen={showForgotModal}
          onClose={() => setShowForgotModal(false)}
        />
      )}
    </main>
  )
}

function TwoFactorLogin({ onVerify, onBack }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await onVerify(code)
    } catch (requestError) {
      setError(requestError.message || 'Invalid authentication code.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="hibernation-page">
      <div className="grid-overlay" />
      <section className="login-card" style={{ maxWidth: '440px', textAlign: 'center' }}>
        <Crest small />
        <span className="badge badge-president" style={{ margin: '14px 0 8px', display: 'inline-block' }}>
          SECURITY CHALLENGE
        </span>
        <h2 style={{ font: '700 24px Syne', color: 'var(--text-main)', margin: '4px 0 8px' }}>Security Verification</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '0 0 20px' }}>
          Enter the six-digit verification code from your authenticator app (or President Master PIN).
        </p>

        <form onSubmit={submit}>
          <div className="login-field-group" style={{ textAlign: 'left' }}>
            <label htmlFor="two-factor-code">6-Digit Security Code / PIN</label>
            <div className="login-input-wrapper">
              <span className="login-input-icon"><Icon8 name="keySecurity" size={14} /></span>
              <input
                id="two-factor-code"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                required
                style={{ textAlign: 'center', fontSize: '18px', letterSpacing: '0.3em', paddingLeft: '20px' }}
              />
            </div>
          </div>

          {error && (
            <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid #ef444455', color: '#fca5a5', fontSize: '12px', marginBottom: '16px' }} role="alert">
              {error}
            </div>
          )}

          <button className="primary" disabled={loading || code.length !== 6} style={{ width: '100%', minHeight: '46px' }}>
            {loading ? 'VERIFYING…' : 'VERIFY & CONTINUE →'}
          </button>
        </form>

        <button className="back-button" type="button" onClick={onBack} style={{ marginTop: '20px', display: 'inline-flex' }}>
          ← Back to sign in
        </button>
      </section>
    </main>
  )
}

function PasswordResetRequest({ onBack }) {
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event) {
    event.preventDefault()
    const memberId = String(new FormData(event.currentTarget).get('memberId') || '').trim().toUpperCase()
    setError('')
    setLoading(true)
    try {
      const result = await authApi.requestPasswordReset(memberId)
      setMessage(result.message)
    } catch (requestError) {
      setError(requestError.message || 'Unable to request password reset.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="hibernation-page">
      <div className="grid-overlay" />
      <section className="login-card" style={{ maxWidth: '440px' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Crest small />
          <span className="badge badge-president" style={{ margin: '12px auto 6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            PASSWORD RECOVERY
          </span>
          <h2 style={{ font: '700 24px Syne', color: 'var(--text-main)', margin: '4px 0 6px' }}>Reset Your Password</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: 0 }}>
            Enter your Member ID to receive password recovery instructions.
          </p>
        </div>

        <form onSubmit={submit}>
          <div className="login-field-group">
            <label htmlFor="recovery-member-id">Member ID</label>
            <div className="login-input-wrapper">
              <span className="login-input-icon"><Icon8 name="idDocs" size={14} /></span>
              <input id="recovery-member-id" name="memberId" required maxLength={32} pattern="[A-Za-z0-9]+" autoComplete="username" placeholder="e.g. CSC2026M01" />
            </div>
          </div>

          {error && <p className="member-form-error">{error}</p>}
          {message && <p className="member-form-success">{message}</p>}

          <button className="primary" disabled={loading} style={{ width: '100%', minHeight: '44px', marginTop: '10px' }}>
            {loading ? 'SENDING INSTRUCTIONS…' : 'SEND RESET INSTRUCTIONS'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '18px' }}>
          <button className="back-button" type="button" onClick={onBack}>
            ← Back to sign in
          </button>
        </div>
      </section>
    </main>
  )
}

function PasswordReset({ token, onComplete }) {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = String(form.get('password') || '')
    if (password !== String(form.get('confirmPassword') || '')) {
      setError('Passwords do not match.')
      return
    }
    setError('')
    setLoading(true)
    try {
      await authApi.resetPassword(token, password)
      onComplete()
    } catch (requestError) {
      setError(requestError.message || 'Unable to reset password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="hibernation-page">
      <div className="grid-overlay" />
      <section className="login-card" style={{ maxWidth: '440px' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Crest small />
          <h2 style={{ font: '700 24px Syne', color: 'var(--text-main)', margin: '10px 0 6px' }}>Set New Password</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: 0 }}>
            Must be at least 12 characters with uppercase, lowercase, number, and symbol.
          </p>
        </div>

        <form onSubmit={submit}>
          <div className="login-field-group">
            <label htmlFor="new-password">New Password</label>
            <div className="login-input-wrapper">
              <input id="new-password" name="password" type="password" minLength={12} required autoComplete="new-password" placeholder="At least 12 characters" />
            </div>
          </div>
          <div className="login-field-group">
            <label htmlFor="confirm-password">Confirm New Password</label>
            <div className="login-input-wrapper">
              <input id="confirm-password" name="confirmPassword" type="password" minLength={12} required autoComplete="new-password" placeholder="Repeat password" />
            </div>
          </div>

          {error && <p className="member-form-error">{error}</p>}

          <button className="primary" disabled={loading} style={{ width: '100%', minHeight: '44px', marginTop: '10px' }}>
            {loading ? 'UPDATING…' : 'UPDATE PASSWORD & SIGN IN'}
          </button>
        </form>
      </section>
    </main>
  )
}

// ----------------------------------------------------
// Account Security, Password Manager & Master Locks
// ----------------------------------------------------
function AccountSecurity({ user, logout, onNavigate }) {
  const [setup, setSetup] = useState(null)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Change Password state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [pwMessage, setPwMessage] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwLoading, setPwLoading] = useState(false)

  // Master PIN (Primary President only)
  const [masterPin, setMasterPin] = useState('')
  const [masterPinPassword, setMasterPinPassword] = useState('')
  const [pinMessage, setPinMessage] = useState('')
  const [pinError, setPinError] = useState('')

  // Session termination state
  const [sessionMessage, setSessionMessage] = useState('')
  const [terminatingSessions, setTerminatingSessions] = useState(false)

  const hasLength = newPassword.length >= 12
  const hasLower = /[a-z]/.test(newPassword)
  const hasUpper = /[A-Z]/.test(newPassword)
  const hasNumber = /\d/.test(newPassword)
  const hasSymbol = /[^A-Za-z0-9]/.test(newPassword)

  const securityScore = useMemo(() => {
    let score = 50 // Base score for bcrypt account
    if (user.twoFactorEnabled) score += 30
    if (user.isPrimaryAdmin) score += 10
    if (newPassword && hasLength && hasUpper && hasLower && hasNumber && hasSymbol) score += 10
    return Math.min(100, score)
  }, [user, newPassword, hasLength, hasUpper, hasLower, hasNumber, hasSymbol])

  async function handleChangePassword(e) {
    e.preventDefault()
    setPwError('')
    setPwMessage('')

    if (newPassword !== confirmNewPassword) {
      setPwError('New passwords do not match.')
      return
    }
    if (newPassword.length < 8) {
      setPwError('New password must be at least 8 characters long.')
      return
    }

    setPwLoading(true)
    try {
      const res = await authApi.changePassword(currentPassword, newPassword)
      setPwMessage(res.message || '✓ Password changed successfully!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmNewPassword('')
    } catch (err) {
      setPwError(err.message || 'Failed to update password.')
    } finally {
      setPwLoading(false)
    }
  }

  async function startSetup() {
    setError('')
    setMessage('')
    setLoading(true)
    try {
      setSetup(await authApi.startTwoFactorSetup())
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  async function confirmSetup(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await authApi.confirmTwoFactorSetup(code)
      setSetup(null)
      setCode('')
      setMessage('✓ Two-factor authentication (TOTP) is now active on your account.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  async function disableSetup(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await authApi.disableTwoFactor(password, code)
      setPassword('')
      setCode('')
      setMessage('Two-factor authentication has been disabled.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSetMasterPin(e) {
    e.preventDefault()
    setPinError('')
    setPinMessage('')
    try {
      const res = await adminApi.setPresidentMasterPin(masterPin, masterPinPassword)
      setPinMessage(res.message)
      setMasterPin('')
      setMasterPinPassword('')
    } catch (err) {
      setPinError(err.message)
    }
  }

  async function handleTerminateOtherSessions() {
    setTerminatingSessions(true)
    setSessionMessage('')
    try {
      await authApi.logoutAllSessions()
      setSessionMessage('✓ All other device sessions terminated. Only this browser session remains active.')
    } catch (err) {
      setSessionMessage(err.message || 'Failed to terminate other sessions.')
    } finally {
      setTerminatingSessions(false)
    }
  }

  return (
    <LivePortal user={user} logout={logout} activeTab="security" onNavigate={onNavigate} title="ACCOUNT SECURITY">
      <section className="member-management">
        <div className="member-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate(user.isAdminUser ? 'admin-dashboard' : 'student-dashboard')}>
              ← BACK TO DASHBOARD
            </button>
            <p className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <IconShieldCheck size={14} /> CYBER DEFENSE & AUTHENTICATION PROTOCOLS
            </p>
            <h1>Account Security & Protection</h1>
            <p>Manage authentication credentials, configure multi-factor hardware/software locks, and monitor active sessions.</p>
          </div>
          <span className="president-lock" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Icon8 name="authentication" size={14} />
            {user.twoFactorEnabled ? '2FA ACTIVE' : '2FA OPTIONAL'}
          </span>
        </div>

        {/* Security Posture HUD Bar */}
        <div className="roster-stats-hud" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div className="roster-stat-card">
            <span className="roster-stat-label">SECURITY HEALTH SCORE</span>
            <span className="roster-stat-value" style={{ color: securityScore >= 80 ? '#10b981' : '#f59e0b' }}>
              {securityScore}%
            </span>
            <small style={{ color: 'var(--text-dim)', fontSize: '10px' }}>
              {securityScore >= 80 ? 'Optimal Protection' : 'Action Recommended'}
            </small>
          </div>
          <div className="roster-stat-card">
            <span className="roster-stat-label">2FA AUTHENTICATOR</span>
            <span className="roster-stat-value" style={{ color: user.twoFactorEnabled ? '#10b981' : '#ef4444', fontSize: '15px' }}>
              {user.twoFactorEnabled ? '● ENABLED' : '○ DISABLED'}
            </span>
            <small style={{ color: 'var(--text-dim)', fontSize: '10px' }}>
              {user.twoFactorEnabled ? 'TOTP Authenticator Active' : 'Setup Authenticator Below'}
            </small>
          </div>
          <div className="roster-stat-card">
            <span className="roster-stat-label">PASSWORD ENCRYPTION</span>
            <span className="roster-stat-value" style={{ color: 'var(--brand-primary)', fontSize: '15px' }}>
              BCRYPT 10-SALT
            </span>
            <small style={{ color: 'var(--text-dim)', fontSize: '10px' }}>Industry Grade Hash</small>
          </div>
          <div className="roster-stat-card">
            <span className="roster-stat-label">MEMBER IDENTITY</span>
            <span className="roster-stat-value" style={{ color: 'var(--text-main)', fontSize: '15px', fontFamily: 'DM Mono' }}>
              {user.memberId}
            </span>
            <small style={{ color: 'var(--brand-eyebrow)', fontSize: '10px' }}>
              {user.isPrimaryAdmin ? 'Primary President' : getRoleLabel(user.role)}
            </small>
          </div>
        </div>

        {/* Primary President Dual Lock Master PIN Card */}
        {user.isPrimaryAdmin && (
          <article className="account-form-card security-card" style={{ marginBottom: '24px', border: '1px solid rgba(245, 158, 11, 0.4)', background: 'linear-gradient(180deg, rgba(245, 158, 11, 0.06) 0%, var(--bg-card) 100%)' }}>
            <p className="eyebrow" style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <IconCrown size={15} /> PRIMARY PRESIDENT DUAL LOCK (TWO MASTER KEYS)
            </p>
            <h2 style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '8px', margin: '6px 0 10px' }}>
              Dual 6-Digit Master Security PIN
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.6', margin: '0 0 16px' }}>
              Set a dedicated 6-digit Master PIN for your Primary President account. When enabled, signing into the Primary President account requires your password + this 6-digit PIN.
            </p>
            <form onSubmit={handleSetMasterPin}>
              <div className="member-form-grid">
                <label>
                  New 6-Digit Master PIN *
                  <input
                    type="password"
                    maxLength={6}
                    pattern="\d{6}"
                    required
                    placeholder="e.g. 849201"
                    value={masterPin}
                    onChange={e => setMasterPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  />
                </label>
                <label>
                  Current Account Password *
                  <input
                    type="password"
                    required
                    placeholder="Enter current password"
                    value={masterPinPassword}
                    onChange={e => setMasterPinPassword(e.target.value)}
                  />
                </label>
              </div>
              {pinError && <p className="member-form-error">{pinError}</p>}
              {pinMessage && <p className="member-form-success">{pinMessage}</p>}
              <button className="primary member-submit" disabled={masterPin.length !== 6 || !masterPinPassword} style={{ marginTop: '14px', background: 'linear-gradient(135deg,#f59e0b,#d97706)', borderColor: '#f59e0b' }}>
                SET 6-DIGIT MASTER SECURITY PIN
              </button>
            </form>
          </article>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          {/* Card 1: Change Account Password */}
          <article className="account-form-card security-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ padding: '8px', borderRadius: '8px', background: 'var(--brand-badge-bg)', color: 'var(--brand-primary)', display: 'inline-flex' }}>
                <Icon8 name="password" size={18} />
              </span>
              <div>
                <p className="eyebrow" style={{ margin: 0 }}>CREDENTIAL UPDATE</p>
                <h2 style={{ margin: 0, fontSize: '18px' }}>Change Password</h2>
              </div>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.5, margin: '0 0 16px' }}>
              Update your account password. Strong passwords contain uppercase, lowercase, numbers, and symbols.
            </p>

            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                  Current Password *
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  required
                  style={{ width: '100%', height: '40px', padding: '0 12px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                  New Password *
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Enter new strong password"
                  required
                  minLength={8}
                  style={{ width: '100%', height: '40px', padding: '0 12px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)' }}
                />
                {newPassword && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                    <span className="badge" style={{ fontSize: '9px', background: hasLength ? 'rgba(16, 185, 129, 0.15)' : 'var(--panel-subtle)', color: hasLength ? '#10b981' : 'var(--text-dim)' }}>
                      {hasLength ? '✓ 12+ chars' : '12+ chars'}
                    </span>
                    <span className="badge" style={{ fontSize: '9px', background: hasUpper ? 'rgba(16, 185, 129, 0.15)' : 'var(--panel-subtle)', color: hasUpper ? '#10b981' : 'var(--text-dim)' }}>
                      {hasUpper ? '✓ Uppercase' : 'Uppercase'}
                    </span>
                    <span className="badge" style={{ fontSize: '9px', background: hasLower ? 'rgba(16, 185, 129, 0.15)' : 'var(--panel-subtle)', color: hasLower ? '#10b981' : 'var(--text-dim)' }}>
                      {hasLower ? '✓ Lowercase' : 'Lowercase'}
                    </span>
                    <span className="badge" style={{ fontSize: '9px', background: hasNumber ? 'rgba(16, 185, 129, 0.15)' : 'var(--panel-subtle)', color: hasNumber ? '#10b981' : 'var(--text-dim)' }}>
                      {hasNumber ? '✓ Number' : 'Number'}
                    </span>
                    <span className="badge" style={{ fontSize: '9px', background: hasSymbol ? 'rgba(16, 185, 129, 0.15)' : 'var(--panel-subtle)', color: hasSymbol ? '#10b981' : 'var(--text-dim)' }}>
                      {hasSymbol ? '✓ Symbol' : 'Symbol'}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  value={confirmNewPassword}
                  onChange={e => setConfirmNewPassword(e.target.value)}
                  placeholder="Repeat new password"
                  required
                  minLength={8}
                  style={{ width: '100%', height: '40px', padding: '0 12px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)' }}
                />
              </div>

              {pwError && <p className="member-form-error" role="alert">{pwError}</p>}
              {pwMessage && <p className="member-form-success" role="status">{pwMessage}</p>}

              <button className="primary member-submit" type="submit" disabled={pwLoading || !currentPassword || !newPassword || !confirmNewPassword} style={{ marginTop: '8px' }}>
                {pwLoading ? 'SAVING NEW PASSWORD…' : 'UPDATE ACCOUNT PASSWORD'}
              </button>
            </form>
          </article>

          {/* Card 2: Two-Factor Authenticator (2FA) */}
          <article className="account-form-card security-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ padding: '8px', borderRadius: '8px', background: 'var(--brand-badge-bg)', color: 'var(--brand-primary)', display: 'inline-flex' }}>
                <Icon8 name="authentication" size={18} />
              </span>
              <div>
                <p className="eyebrow" style={{ margin: 0 }}>TWO-FACTOR AUTHENTICATION</p>
                <h2 style={{ margin: 0, fontSize: '18px' }}>Authenticator App (2FA)</h2>
              </div>
            </div>

            {!user.twoFactorEnabled && !setup && (
              <>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.5, margin: '0 0 16px' }}>
                  Protect your account against unauthorized logins with Google Authenticator, Microsoft Authenticator, or Authy.
                </p>
                <div style={{ background: 'var(--panel-subtle)', padding: '14px', borderRadius: '10px', border: '1px solid var(--line)', marginBottom: '16px' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}>Why enable 2FA?</p>
                  <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    <li>Prevents access even if your password is compromised</li>
                    <li>Generates time-synchronized 6-digit security codes</li>
                    <li>Works offline without SMS or email dependency</li>
                  </ul>
                </div>
                <button className="primary member-submit" type="button" onClick={startSetup} disabled={loading} style={{ width: '100%' }}>
                  {loading ? 'PREPARING QR CODE…' : 'ENABLE 2FA AUTHENTICATOR →'}
                </button>
              </>
            )}

            {!user.twoFactorEnabled && setup && (
              <>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '0 0 12px' }}>
                  1. Scan this QR code in your Authenticator app, then enter the 6-digit code below:
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px', background: '#ffffff', padding: '12px', borderRadius: '12px', width: 'fit-content', margin: '0 auto 14px' }}>
                  <img src={setup.qrCodeDataUrl} alt="2FA QR Code" style={{ width: '180px', height: '180px', display: 'block' }} />
                </div>
                <form onSubmit={confirmSetup} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>
                    Enter 6-Digit Authenticator Code
                    <input
                      value={code}
                      onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      inputMode="numeric"
                      placeholder="000000"
                      required
                      style={{ width: '100%', height: '44px', textAlign: 'center', fontSize: '20px', letterSpacing: '6px', fontFamily: 'DM Mono', marginTop: '4px' }}
                    />
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="primary" style={{ flex: 1 }} disabled={loading || code.length !== 6}>
                      {loading ? 'VERIFYING…' : 'ACTIVATE 2FA'}
                    </button>
                    <button type="button" className="outline" onClick={() => setSetup(null)}>
                      Cancel
                    </button>
                  </div>
                </form>
              </>
            )}

            {user.twoFactorEnabled && (
              <>
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '10px', padding: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ color: '#10b981', fontSize: '18px' }}>✓</span>
                  <div>
                    <b style={{ color: '#10b981', fontSize: '13px', display: 'block' }}>2FA Is Active & Enforced</b>
                    <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Your account is protected with multi-factor authentication.</small>
                  </div>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '0 0 14px' }}>
                  To disable two-factor authentication, enter your current account password and live authenticator code:
                </p>
                <form onSubmit={disableSetup} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>
                    Current Password
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Enter password" style={{ width: '100%', marginTop: '4px' }} />
                  </label>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>
                    Live 6-Digit Authenticator Code
                    <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" required maxLength={6} style={{ width: '100%', marginTop: '4px', textAlign: 'center', letterSpacing: '4px', fontFamily: 'DM Mono' }} />
                  </label>
                  <button className="outline" disabled={loading || code.length !== 6 || !password} style={{ color: '#ef4444', borderColor: '#ef4444' }}>
                    {loading ? 'DISABLING…' : 'DISABLE TWO-FACTOR AUTHENTICATION'}
                  </button>
                </form>
              </>
            )}

            {error && <p className="member-form-error" role="alert" style={{ marginTop: '12px' }}>{error}</p>}
            {message && <p className="member-form-success" role="status" style={{ marginTop: '12px' }}>{message}</p>}
          </article>
        </div>

        {/* Card 3: Session Management & Device Security */}
        <article className="account-form-card security-card" style={{ marginTop: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <p className="eyebrow">SESSION MANAGEMENT & DEVICE HYGIENE</p>
              <h3 style={{ margin: '4px 0', fontSize: '16px', color: 'var(--text-main)' }}>Active Device Sessions</h3>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                You are currently signed into this device with a valid encrypted session cookie. If you suspect unauthorized access, terminate all other sessions.
              </p>
            </div>
            <button
              type="button"
              className="outline"
              onClick={handleTerminateOtherSessions}
              disabled={terminatingSessions}
              style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)', fontSize: '11px', padding: '8px 16px', fontWeight: 700 }}
            >
              {terminatingSessions ? 'TERMINATING…' : 'LOGOUT ALL OTHER DEVICES'}
            </button>
          </div>
          {sessionMessage && <p className="member-form-success" style={{ marginTop: '14px' }}>{sessionMessage}</p>}
        </article>
      </section>
    </LivePortal>
  )
}

// ----------------------------------------------------
// Member Management & Leadership Directory
// ----------------------------------------------------
function MemberManagement({ user, logout, onNavigate }) {
  const { platformMode, onSwitchAccount } = usePlatformTheme()
  const isMrdu = platformMode === 'MRDU_EVENTS'

  async function handleSwitchToMember(targetMember) {
    if (!window.confirm(`Switch into account for ${targetMember.name} (${targetMember.memberId})?`)) return
    if (onSwitchAccount) {
      await onSwitchAccount(targetMember.id || targetMember.memberId)
    }
  }
  const [members, setMembers] = useState([])
  const [role, setRole] = useState('STUDENT')
  const [passwordInput, setPasswordInput] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editData, setEditData] = useState({})
  // View Mode: 'ROSTER' (Active Directory) vs 'CREATE' (Account Provisioning Studio)
  const [managementView, setManagementView] = useState('ROSTER')
  const [roleFilter, setRoleFilter] = useState('ALL')

  // Bulk Account Creation States
  const [accountMode, setAccountMode] = useState('single')
  const [bulkText, setBulkText] = useState('')
  const [bulkDefaultRole, setBulkDefaultRole] = useState('STUDENT')
  const [bulkDefaultGender, setBulkDefaultGender] = useState('MALE')
  const [bulkDefaultAge, setBulkDefaultAge] = useState('')
  const [bulkYear, setBulkYear] = useState(1)
  const [bulkCollegeChoice, setBulkCollegeChoice] = useState('Malla Reddy (MR) Deemed to be University')
  const [bulkCollegeCustom, setBulkCollegeCustom] = useState('')
  const [bulkBranch, setBulkBranch] = useState('Cyber Security')
  const [bulkSpecialization, setBulkSpecialization] = useState('')
  const [bulkAutoPassword, setBulkAutoPassword] = useState(true)
  const [bulkSubmitting, setBulkSubmitting] = useState(false)
  const [bulkResultModal, setBulkResultModal] = useState(null)
  const bulkFileInputRef = useRef(null)

  const [transferModalOpen, setTransferModalOpen] = useState(false)
  const [transferTargetId, setTransferTargetId] = useState('')
  const [transferAuthCode, setTransferAuthCode] = useState('')
  const [transferError, setTransferError] = useState('')

  const [resetModalUser, setResetModalUser] = useState(null)
  const [newPasswordInput, setNewPasswordInput] = useState('')
  const [resetError, setResetError] = useState('')
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [resetSubmitting, setResetSubmitting] = useState(false)
  const [resetCopied, setResetCopied] = useState(false)

  const hasLength = passwordInput.length >= 12
  const hasLower = /[a-z]/.test(passwordInput)
  const hasUpper = /[A-Z]/.test(passwordInput)
  const hasNumber = /\d/.test(passwordInput)
  const hasSymbol = /[^A-Za-z0-9]/.test(passwordInput)

  const effectiveBulkCollege = bulkCollegeChoice === 'Other' ? bulkCollegeCustom.trim() : bulkCollegeChoice
  const bulkSpecText = bulkSpecialization ? ` - ${bulkSpecialization}` : ''
  const bulkDepartment = `${bulkBranch}${bulkBranch === 'CSE' ? bulkSpecText : ''} (${effectiveBulkCollege || 'MRDU'})`

  const existingMemberIds = useMemo(() => {
    return new Set((members || []).map(m => (m?.memberId ? String(m.memberId).toUpperCase() : '')).filter(Boolean))
  }, [members])

  function handleDownloadBulkTemplate() {
    const headers = [
      'Full Name',
      'Roll Number / Member ID',
      'Password (Leave empty for auto-generated)',
      'Gender (MALE / FEMALE / OTHER)',
    ]
    const rows = [
      ['Dhanush G', '25EU07R0015', 'Pass@word123!', 'MALE'],
      ['Aditya Sharma', '25EU07R0016', 'Pass@word123!', 'MALE'],
      ['Priya Patel', '25EU07R0017', 'Pass@word123!', 'FEMALE'],
      ['Rahul Verma', '25EU07R0018', 'Pass@word123!', 'MALE'],
    ]
    downloadCsv('bulk_member_provisioning_template.csv', headers, rows)
  }

  function handleBulkFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = evt => {
      const content = evt.target?.result || ''
      setBulkText(content)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function generateAutoPassword(seed) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*'
    let pwd = 'P@ss' + String(seed || '').slice(-3) + '9'
    for (let i = 0; i < 6; i++) pwd += chars[Math.floor(Math.random() * chars.length)]
    return pwd
  }

  const parsedBulkStudents = useMemo(() => {
    if (!bulkText || !bulkText.trim()) return []
    const lines = bulkText.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    if (lines.length === 0) return []

    const firstLineLower = lines[0].toLowerCase()
    const isHeader = (firstLineLower.includes('name') && (firstLineLower.includes('roll') || firstLineLower.includes('id') || firstLineLower.includes('member')))
    const dataLines = isHeader ? lines.slice(1) : lines

    const batchMemberIds = new Set()
    const batchEmails = new Set()

    const isGenderString = str => ['MALE', 'FEMALE', 'OTHER'].includes(String(str || '').trim().toUpperCase())

    const validRoleKeys = ['PRESIDENT', 'VICE_PRESIDENT', 'STUDENT_COORDINATOR', 'COORDINATOR', 'TREASURER', 'EVENT_MANAGEMENT', 'MEDIA_LEAD', 'SOCIAL_MEDIA_LEAD', 'TECH_TEAM', 'PR_TEAM', 'CULTURAL', 'SECRETARY', 'ADMIN', 'STUDENT']
    const normalizeRole = (r) => {
      const up = String(r || '').trim().toUpperCase().replace(/[\s-]+/g, '_')
      if (up === 'COORDINATOR' || up === 'STUDENT_COORDINATOR' || up === 'LEAD_COORDINATOR') return 'STUDENT_COORDINATOR'
      if (up === 'VICE_PRESIDENT' || up === 'VP') return 'VICE_PRESIDENT'
      if (up === 'EVENT_LEAD' || up === 'EVENTS' || up === 'EVENT_MANAGEMENT') return 'EVENT_MANAGEMENT'
      if (up === 'TECH' || up === 'TECH_LEAD' || up === 'TECH_TEAM') return 'TECH_TEAM'
      if (up === 'MEDIA' || up === 'MEDIA_LEAD') return 'MEDIA_LEAD'
      if (up === 'SOCIAL_MEDIA' || up === 'SOCIAL_MEDIA_LEAD') return 'SOCIAL_MEDIA_LEAD'
      if (up === 'PR' || up === 'PR_LEAD' || up === 'PR_TEAM') return 'PR_TEAM'
      if (validRoleKeys.includes(up)) return up
      return null
    }

    return dataLines.map((line, index) => {
      let parts = []
      if (line.includes('\t')) {
        parts = line.split('\t').map(p => p.trim())
      } else if (line.includes(',') || line.includes(';')) {
        const matches = line.match(/(".*?"|[^",;]+)(?=\s*[,;]|\s*$)/g)
        parts = matches ? matches.map(m => m.replace(/^"(.*)"$/, '$1').trim()) : line.split(/[,;]/).map(p => p.trim())
      } else {
        parts = line.split(/\s{2,}/).map(p => p.trim())
      }

      let parsedRole = null
      let name = ''
      let rawMemberId = ''
      let rawPassword = ''
      let part3 = ''
      let part4 = ''
      let part5 = ''

      // Auto-detect if column 1 is Role (e.g. Role \t Name \t ID \t Password)
      const roleFromPart0 = normalizeRole(parts[0])
      if (roleFromPart0 && parts.length >= 3) {
        parsedRole = roleFromPart0
        name = String(parts[1] || '').trim()
        rawMemberId = String(parts[2] || '').trim().toUpperCase()
        rawPassword = String(parts[3] || '').trim()
        part3 = String(parts[4] || '').trim()
        part4 = String(parts[5] || '').trim()
        part5 = String(parts[6] || '').trim()
      } else {
        name = String(parts[0] || '').trim()
        rawMemberId = String(parts[1] || '').trim().toUpperCase()
        rawPassword = String(parts[2] || '').trim()
        part3 = String(parts[3] || '').trim()
        part4 = String(parts[4] || '').trim()
        part5 = String(parts[5] || '').trim()
      }

      let gender = bulkDefaultGender
      let email = null
      let phone = null

      if (isGenderString(part3)) {
        gender = part3.toUpperCase()
      } else if (part3.includes('@')) {
        email = part3
        phone = part4 || null
        if (isGenderString(part5)) gender = part5.toUpperCase()
      } else if (isGenderString(part4)) {
        gender = part4.toUpperCase()
      } else if (isGenderString(part5)) {
        gender = part5.toUpperCase()
      }

      if (!rawPassword && bulkAutoPassword && rawMemberId) {
        rawPassword = generateAutoPassword(rawMemberId)
      }

      const role = parsedRole || bulkDefaultRole
      const department = bulkDepartment
      const year = Number(bulkYear) || 1
      const age = bulkDefaultAge ? Number(bulkDefaultAge) : null

      const errors = []
      if (!name) errors.push('Missing Name')
      if (!rawMemberId) {
        errors.push('Missing Roll Number')
      } else if (!/^[A-Za-z0-9]{4,32}$/.test(rawMemberId)) {
        errors.push('Alphanumeric 4-32 chars')
      } else if (existingMemberIds.has(rawMemberId)) {
        errors.push('Roll No / Member ID already exists')
      } else if (batchMemberIds.has(rawMemberId)) {
        errors.push('Duplicate in this batch')
      } else {
        batchMemberIds.add(rawMemberId)
      }

      if (!rawPassword) {
        errors.push('Missing Password')
      } else if (rawPassword.length < 8) {
        errors.push('Password min 8 chars')
      }

      if (email) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          errors.push('Invalid Email')
        } else if (batchEmails.has(email.toLowerCase())) {
          errors.push('Duplicate Email in batch')
        } else {
          batchEmails.add(email.toLowerCase())
        }
      }

      return {
        index: index + 1,
        name,
        memberId: rawMemberId,
        rollNumber: rawMemberId,
        password: rawPassword,
        email,
        phone,
        gender,
        age,
        role,
        department,
        year,
        isValid: errors.length === 0,
        errors,
      }
    })
  }, [bulkText, bulkYear, bulkDepartment, bulkDefaultRole, bulkDefaultGender, bulkDefaultAge, bulkAutoPassword, existingMemberIds])

  const validBulkCount = (parsedBulkStudents || []).filter(s => s.isValid).length
  const invalidBulkCount = (parsedBulkStudents || []).length - validBulkCount

  function loadMembers() {
    setLoading(true)
    adminApi.listMembers()
      .then(res => {
        setMembers(Array.isArray(res?.users) ? res.users : Array.isArray(res) ? res : [])
      })
      .catch(err => {
        setError(err.message || 'Failed to load member accounts.')
        setMembers([])
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadMembers()
  }, [platformMode])

  async function createAccount(e) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setMessage('')
    setError('')

    const rawYear = String(form.get('year') || '').trim()
    const rawAge = String(form.get('age') || '').trim()
    const account = {
      memberId: String(form.get('memberId') || '').trim().toUpperCase(),
      password: passwordInput,
      role,
      profile: {
        name: String(form.get('name') || '').trim(),
        gender: String(form.get('gender') || 'MALE'),
        age: rawAge ? Number(rawAge) : null,
        rollNumber: String(form.get('rollNumber') || '').trim() || null,
        department: String(form.get('department') || '').trim() || null,
        year: rawYear ? Number(rawYear) : null,
        email: String(form.get('email') || '').trim() || null,
        phone: String(form.get('phone') || '').trim() || null,
      },
    }

    setSubmitting(true)
    try {
      const { user: created } = await adminApi.createMember(account)
      setMembers(c => [created, ...c])
      e.currentTarget.reset()
      setPasswordInput('')
      setRole('STUDENT')
      setMessage(`Account created for ${created.name} (${getRoleLabel(created.role)}) · Member ID: ${created.memberId}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleBulkSubmit(e) {
    e.preventDefault()
    const validRows = parsedBulkStudents.filter(s => s.isValid)
    if (validRows.length === 0) {
      setError('Please resolve all validation errors in the student batch before creating accounts.')
      return
    }

    setBulkSubmitting(true)
    setError('')
    setMessage('')

    try {
      const payload = validRows.map(r => ({
        name: r.name,
        memberId: r.memberId,
        password: r.password,
        role: r.role,
        gender: r.gender,
        age: r.age,
        rollNumber: r.rollNumber || r.memberId,
        year: r.year,
        department: r.department,
        email: r.email,
        phone: r.phone,
      }))

      const res = await adminApi.bulkCreateMembers(payload)
      if (res.createdUsers && res.createdUsers.length > 0) {
        setMembers(prev => [...res.createdUsers, ...prev])
      }

      setBulkResultModal(res)
      if (res.failedCount === 0) {
        setBulkText('')
        setMessage(`Successfully created all ${res.successCount} student accounts!`)
      } else {
        setMessage(`Batch completed: ${res.successCount} created, ${res.failedCount} failed.`)
      }
    } catch (err) {
      setError(err.message || 'Bulk account creation failed.')
    } finally {
      setBulkSubmitting(false)
    }
  }

  async function updateMember(id) {
    setMessage('')
    setError('')
    setSubmitting(true)
    try {
      const { user: updated } = await adminApi.editMember(id, editData)
      setMembers(c => c.map(m => (m.id === id ? updated : m)))
      setEditingId(null)
      setEditData({})
      setMessage('Member details updated.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleStatus(member) {
    if (member.isPrimaryAdmin) return
    const nextStatus = member.accountStatus === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'
    try {
      const { user: updated } = await adminApi.updateMemberStatus(member.id, nextStatus)
      setMembers(c => c.map(m => (m.id === member.id ? updated : m)))
    } catch (err) {
      setError(err.message)
    }
  }

  const [activatingAll, setActivatingAll] = useState(false)
  const disabledCount = useMemo(() => members.filter(m => m.accountStatus !== 'ACTIVE').length, [members])

  async function handleActivateAllAccounts() {
    setActivatingAll(true)
    setMessage('')
    setError('')
    try {
      const res = await adminApi.activateAllAccounts()
      setMembers(c => c.map(m => ({ ...m, accountStatus: 'ACTIVE' })))
      setMessage(res.message || '✓ All accounts have been activated successfully!')
    } catch (err) {
      setError(err.message || 'Failed to activate accounts.')
    } finally {
      setActivatingAll(false)
    }
  }

  async function handleDisable2FA(member) {
    if (!confirm(`Are you sure you want to disable 2FA for ${member.name} (${member.memberId})?`)) return
    try {
      const res = await adminApi.disableMemberTwoFactor(member.id)
      setMessage(res.message)
      loadMembers()
    } catch (err) {
      setError(err.message)
    }
  }

  async function removeMember(member) {
    if (member.isPrimaryAdmin || member.role === 'PRESIDENT') {
      alert('The Primary President account cannot be deleted. Primary President status must first be transferred.')
      return
    }
    if (!confirm(`Are you sure you want to delete member ${member.name} (${member.memberId})?`)) return
    try {
      await adminApi.deleteMember(member.id)
      setMembers(c => c.filter(m => m.id !== member.id))
      setMessage(`Member ${member.memberId} removed.`)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleAdminResetPassword(e) {
    e.preventDefault()
    setResetError('')
    setResetSubmitting(true)
    try {
      const res = await adminApi.adminResetPassword(resetModalUser.id, newPasswordInput)
      setMessage(res.message || `Password reset successfully for ${resetModalUser.memberId}.`)
      setResetModalUser(null)
      setNewPasswordInput('')
      setShowResetPassword(false)
    } catch (err) {
      setResetError(err.message || 'Failed to reset password.')
    } finally {
      setResetSubmitting(false)
    }
  }

  function handleGenerateAdminPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*'
    let pwd = ''
    pwd += 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]
    pwd += 'abcdefghijkmnopqrstuvwxyz'[Math.floor(Math.random() * 24)]
    pwd += '23456789'[Math.floor(Math.random() * 8)]
    pwd += '!@#$%&*'[Math.floor(Math.random() * 7)]
    for (let i = 0; i < 10; i++) {
      pwd += chars[Math.floor(Math.random() * chars.length)]
    }
    const generated = pwd.split('').sort(() => 0.5 - Math.random()).join('')
    setNewPasswordInput(generated)
    setShowResetPassword(true)
  }

  function handleCopyResetPassword() {
    if (!newPasswordInput) return
    navigator.clipboard?.writeText(newPasswordInput)
    setResetCopied(true)
    setTimeout(() => setResetCopied(false), 2000)
  }
  async function handleTransferLeadership(e) {
    e.preventDefault()
    setTransferError('')
    try {
      const res = await adminApi.transferPresidentRole(transferTargetId, transferAuthCode)
      setMessage(res.message)
      setTransferModalOpen(false)
      setTransferAuthCode('')
      loadMembers()
    } catch (err) {
      setTransferError(err.message)
    }
  }

  const filteredMembers = members.filter(m => {
    if (roleFilter === 'STUDENT' && m.role !== 'STUDENT') return false
    if (roleFilter === 'ADMIN' && m.role === 'STUDENT') return false
    if (roleFilter === '2FA' && !m.twoFactorEnabled) return false
    const q = searchQuery.toLowerCase()
    return (
      m.memberId?.toLowerCase().includes(q) ||
      m.name?.toLowerCase().includes(q) ||
      m.email?.toLowerCase().includes(q) ||
      m.role?.toLowerCase().includes(q) ||
      m.rollNumber?.toLowerCase().includes(q) ||
      m.profile?.rollNumber?.toLowerCase().includes(q) ||
      m.department?.toLowerCase().includes(q) ||
      m.profile?.department?.toLowerCase().includes(q)
    )
  })

  function handleDownloadMembersCsv() {
    const headers = [
      'Member ID',
      'Full Name',
      'Role',
      'Roll Number',
      'Department / Branch',
      'Academic Year',
      'Official Email',
      'Phone Number',
      'Account Status',
      'Two-Factor Enabled',
      'Joined Date',
    ]
    const rows = filteredMembers.map(m => [
      m.memberId,
      m.name,
      getRoleLabel(m.role),
      m.rollNumber || m.profile?.rollNumber,
      m.department || m.profile?.department,
      m.year || m.profile?.year,
      m.email || m.profile?.email,
      m.phone || m.profile?.phone,
      m.accountStatus,
      m.twoFactorEnabled ? 'Enabled' : 'Disabled',
      m.createdAt ? new Date(m.createdAt).toLocaleDateString() : null,
    ])
    downloadCsv('club_members_roster.csv', headers, rows)
  }

  return (
    <LivePortal user={user} logout={logout} activeTab="admin-members" onNavigate={onNavigate} title="MEMBER & ROLE DIRECTORY">
      <section className="member-management">
        <div className="member-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate('admin-dashboard')}>
              ← COMMAND CENTER
            </button>
            <p className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Icon8 name="idDocs" size={14} /> ROLE-BASED ACCESS CONTROL
            </p>
            <h1>Club Members & Directory</h1>
            <p>Add new club members, assign predefined roles, manage 2FA locks, and oversee authorized access.</p>
          </div>
          <div className="member-heading-actions">
            {user.isPrimaryAdmin && (
              <button className="outline" type="button" onClick={() => setTransferModalOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '7px 14px' }}>
                <IconCrown size={14} /> Transfer Leadership
              </button>
            )}
            <button
              type="button"
              className="outline"
              onClick={handleDownloadMembersCsv}
              disabled={members.length === 0}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '7px 14px' }}
              title="Download member roster as CSV"
            >
              <IconDownload size={13} /> Export Roster CSV
            </button>
            <button
              type="button"
              className="primary"
              onClick={handleActivateAllAccounts}
              disabled={activatingAll}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                padding: '7px 14px',
                background: disabledCount > 0 ? '#10b981' : 'rgba(16, 185, 129, 0.15)',
                borderColor: '#10b981',
                color: disabledCount > 0 ? '#fff' : '#10b981',
                fontWeight: 700,
              }}
              title="Activate all member accounts immediately in 1 click"
            >
              ⚡ {activatingAll ? 'ACTIVATING ALL…' : disabledCount > 0 ? `ACTIVATE ALL (${disabledCount} DISABLED)` : 'ACTIVATE ALL ACCOUNTS'}
            </button>
            {(user.role === 'STUDENT_COORDINATOR' || user.isPrimaryAdmin || user.role === 'PRESIDENT') && (
              <button
                type="button"
                className="outline"
                onClick={() => onNavigate('admin-coordinator')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '7px 14px', borderColor: 'var(--brand-primary)', color: 'var(--brand-primary)' }}
              >
                <IconShieldCheck size={13} /> 🛡️ Coordinator Console →
              </button>
            )}
          </div>
        </div>

        {message && <p className="member-form-success">{message}</p>}
        {error && <p className="member-form-error">{error}</p>}

        <div className="member-view-switcher">
          <button
            type="button"
            className={managementView === 'ROSTER' ? 'primary active' : 'outline'}
            onClick={() => setManagementView('ROSTER')}
          >
            <Icon8 name="idDocs" size={14} /> Member Directory ({members.length})
          </button>
          <button
            type="button"
            className={managementView === 'CREATE' ? 'primary active' : 'outline'}
            onClick={() => setManagementView('CREATE')}
          >
            <IconUserSvg size={14} /> ＋ Provision New Account
          </button>
        </div>

        {managementView === 'CREATE' ? (
          /* Full-Width Account Creation Studio */
          <article className="account-form-card" style={{ maxWidth: '960px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <p className="eyebrow">{accountMode === 'single' ? 'PROVISION MEMBER ACCOUNT' : 'BATCH STUDENT PROVISIONING'}</p>
                <h2>{accountMode === 'single' ? 'Create New Member Account' : 'Bulk Student Accounts Provisioning'}</h2>
              </div>
              <button
                type="button"
                className="outline"
                onClick={() => setManagementView('ROSTER')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}
              >
                ← BACK TO MEMBER DIRECTORY
              </button>
            </div>

            {/* Tab Switcher: Individual Account vs Bulk Accounts */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--line)', paddingBottom: '12px' }}>
              <button
                type="button"
                className={`tab-btn ${accountMode === 'single' ? 'active' : ''}`}
                onClick={() => setAccountMode('single')}
                style={{
                  background: accountMode === 'single' ? 'var(--brand-glow)' : 'transparent',
                  color: accountMode === 'single' ? 'var(--brand-primary)' : 'var(--text-muted)',
                  border: accountMode === 'single' ? '1px solid var(--brand-primary)' : '1px solid transparent',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <IconUserSvg size={14} /> Individual Account
              </button>
              <button
                type="button"
                className={`tab-btn ${accountMode === 'bulk' ? 'active' : ''}`}
                onClick={() => setAccountMode('bulk')}
                style={{
                  background: accountMode === 'bulk' ? 'var(--brand-glow)' : 'transparent',
                  color: accountMode === 'bulk' ? 'var(--brand-primary)' : 'var(--text-muted)',
                  border: accountMode === 'bulk' ? '1px solid var(--brand-primary)' : '1px solid transparent',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <IconDownload size={14} /> Bulk Accounts (Excel / CSV Batch)
              </button>
            </div>

            {accountMode === 'single' ? (
              <>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '0 0 16px' }}>
                  Provisioning authorized account as: <b style={{ color: 'var(--brand-primary)' }}>{user.name} ({user.memberId})</b>
                </p>

                <form onSubmit={createAccount}>
                  <div className="member-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                    <label>
                      Member ID (Unique) *
                      <input name="memberId" required placeholder="e.g. CSC2026M01" />
                    </label>
                    <label>
                      Assigned Club Role *
                      <select
                        className="member-select"
                        value={role}
                        onChange={e => setRole(e.target.value)}
                      >
                        {CLUB_ROLES.map(r => (
                          <option key={r.id} value={r.id}>
                            {r.label} ({r.roleType.toUpperCase()})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Full Name *
                      <input name="name" required placeholder="Full Name" />
                    </label>
                    <label>
                      Gender
                      <select className="member-select" name="gender" defaultValue="MALE">
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </label>
                    <label>
                      Age
                      <input name="age" type="number" min={15} max={65} placeholder="Age (e.g. 20)" />
                    </label>
                    <label>
                      College Roll Number
                      <input name="rollNumber" placeholder="e.g. 25EU07R0015" />
                    </label>
                    <label>
                      Department / Branch
                      <input name="department" placeholder="e.g. Cyber Security" />
                    </label>
                    <label>
                      Academic Year
                      <select className="member-select" name="year" defaultValue="1">
                        {ACADEMIC_YEARS.map(y => (
                          <option key={y.value} value={y.value}>{y.label}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Official Email
                      <input name="email" type="email" placeholder="student@college.edu" />
                    </label>
                    <label>
                      Phone Number
                      <input name="phone" placeholder="Phone number" />
                    </label>
                    <label className="form-wide" style={{ gridColumn: '1 / -1' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span>Account Password *</span>
                        <button
                          type="button"
                          className="outline"
                          onClick={() => {
                            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*'
                            let pwd = 'A' + 'a' + '9' + '@'
                            for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)]
                            setPasswordInput(pwd.split('').sort(() => 0.5 - Math.random()).join(''))
                            setShowPassword(true)
                          }}
                          style={{ padding: '2px 8px', fontSize: '10px', fontWeight: 600 }}
                        >
                          ⚡ Generate Strong Password
                        </button>
                      </div>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={passwordInput}
                          onChange={e => setPasswordInput(e.target.value)}
                          required
                          placeholder="Min 12 chars (Upper, Lower, Number, Symbol)"
                          style={{ width: '100%', paddingRight: '40px' }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(p => !p)}
                          style={{
                            position: 'absolute',
                            right: '8px',
                            background: 'none',
                            border: 0,
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '4px',
                          }}
                        >
                          {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                        </button>
                      </div>
                    </label>
                  </div>

                  <div className="pwd-rules" style={{ margin: '14px 0' }}>
                    <span className={`pwd-rule ${hasLength ? 'valid' : ''}`}><i>{hasLength ? '✓' : '○'}</i> 12+ Characters</span>
                    <span className={`pwd-rule ${hasUpper ? 'valid' : ''}`}><i>{hasUpper ? '✓' : '○'}</i> Uppercase Letter</span>
                    <span className={`pwd-rule ${hasLower ? 'valid' : ''}`}><i>{hasLower ? '✓' : '○'}</i> Lowercase Letter</span>
                    <span className={`pwd-rule ${hasNumber ? 'valid' : ''}`}><i>{hasNumber ? '✓' : '○'}</i> Number</span>
                    <span className={`pwd-rule ${hasSymbol ? 'valid' : ''}`}><i>{hasSymbol ? '✓' : '○'}</i> Symbol (!@#$)</span>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button className="primary member-submit" disabled={submitting || !hasLength || !hasLower || !hasUpper || !hasNumber || !hasSymbol} style={{ padding: '12px 24px', fontWeight: 700 }}>
                      {submitting ? 'PROVISIONING…' : '＋ CREATE MEMBER ACCOUNT'}
                    </button>
                    <button type="button" className="outline" onClick={() => setManagementView('ROSTER')}>Cancel</button>
                  </div>
                </form>
              </>
            ) : (
              /* Bulk Account Creation Interface */
              <div className="bulk-accounts-container">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: 0 }}>
                    Paste data directly from Excel / CSV or upload a spreadsheet (<b>Name | Roll Number | Password | Gender</b>).
                  </p>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="file"
                      ref={bulkFileInputRef}
                      onChange={handleBulkFileUpload}
                      accept=".csv,.tsv,.txt"
                      style={{ display: 'none' }}
                    />
                    <button
                      type="button"
                      className="outline"
                      onClick={() => bulkFileInputRef.current?.click()}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '6px 12px' }}
                    >
                      <IconUpload size={13} /> 📂 Upload Spreadsheet / CSV
                    </button>
                    <button
                      type="button"
                      className="outline"
                      onClick={handleDownloadBulkTemplate}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '6px 12px' }}
                      title="Download template with Name, Roll Number, Password, Gender"
                    >
                      <IconDownload size={13} /> 📥 Download Sample Template (.CSV)
                    </button>
                  </div>
                </div>

                <form onSubmit={handleBulkSubmit}>
                  {/* Step 1: Input Data */}
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ color: 'var(--text-main)', font: '700 11px "DM Mono", monospace' }}>
                        1. Paste Member Data (Full Name | Roll Number / Member ID | Password | Gender)
                      </label>
                      <span style={{ color: 'var(--brand-primary)', fontSize: '10px', font: '600 10px "DM Mono", monospace' }}>
                        Excel Tab / Comma Delimited
                      </span>
                    </div>
                    <textarea
                      className="bulk-textarea"
                      placeholder={`Format: Full Name, Roll Number, Password, Gender\n\nDhanush G\t25EU07R0015\tPass@word123!\tMale\nAditya Sharma\t25EU07R0016\tPass@word123!\tMale\nPriya Patel\t25EU07R0017\tPass@word123!\tFemale\nRahul Verma\t25EU07R0018\tPass@word123!\tMale`}
                      value={bulkText}
                      onChange={e => setBulkText(e.target.value)}
                      style={{ minHeight: '130px', fontFamily: '"DM Mono", monospace', fontSize: '11px', lineHeight: 1.5 }}
                    />
                  </div>

                  {/* Step 2: Common Batch Defaults */}
                  <div style={{ background: 'var(--panel-subtle)', border: '1px solid var(--line)', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                      <label style={{ color: 'var(--brand-primary)', font: '700 11px "DM Mono", monospace' }}>
                        2. Common Batch Settings (Applies to all uploaded accounts)
                      </label>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer', color: 'var(--text-main)', fontWeight: 600 }}>
                        <input
                          type="checkbox"
                          checked={bulkAutoPassword}
                          onChange={e => setBulkAutoPassword(e.target.checked)}
                          style={{ cursor: 'pointer', accentColor: 'var(--brand-primary)' }}
                        />
                        ⚡ Auto-generate secure passwords if omitted
                      </label>
                    </div>

                    <div className="member-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                      <label>
                        Assigned Club Role
                        <select
                          className="member-select"
                          value={bulkDefaultRole}
                          onChange={e => setBulkDefaultRole(e.target.value)}
                        >
                          {CLUB_ROLES.map(r => (
                            <option key={r.id} value={r.id}>{r.label} ({r.roleType.toUpperCase()})</option>
                          ))}
                        </select>
                      </label>

                      <label>
                        Default Gender (Fallback)
                        <select
                          className="member-select"
                          value={bulkDefaultGender}
                          onChange={e => setBulkDefaultGender(e.target.value)}
                        >
                          <option value="MALE">Male</option>
                          <option value="FEMALE">Female</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </label>

                      <label>
                        Academic Year
                        <select
                          className="member-select"
                          value={bulkYear}
                          onChange={e => setBulkYear(Number(e.target.value))}
                        >
                          {ACADEMIC_YEARS.map(y => (
                            <option key={y.value} value={y.value}>{y.label}</option>
                          ))}
                        </select>
                      </label>

                      <label>
                        College / Institution
                        <select
                          className="member-select"
                          value={bulkCollegeChoice}
                          onChange={e => setBulkCollegeChoice(e.target.value)}
                        >
                          <option value="Malla Reddy (MR) Deemed to be University">Malla Reddy (MR) Deemed to be University</option>
                          <option value="Other">Other / External College</option>
                        </select>
                      </label>

                      {bulkCollegeChoice === 'Other' && (
                        <label style={{ gridColumn: '1 / -1' }}>
                          Custom College Name
                          <input
                            placeholder="Enter College Name"
                            value={bulkCollegeCustom}
                            onChange={e => setBulkCollegeCustom(e.target.value)}
                          />
                        </label>
                      )}

                      <label>
                        Department / Branch
                        <select
                          className="member-select"
                          value={bulkBranch}
                          onChange={e => setBulkBranch(e.target.value)}
                        >
                          {BRANCH_OPTIONS.map(b => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                      </label>

                      {bulkBranch === 'CSE' && (
                        <label>
                          CSE Specialization
                          <select
                            className="member-select"
                            value={bulkSpecialization}
                            onChange={e => setBulkSpecialization(e.target.value)}
                          >
                            <option value="">None (General)</option>
                            {CSE_SPECIALIZATIONS.map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Step 3: Live Validation & Preview Table */}
                  {parsedBulkStudents.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                        <label style={{ color: 'var(--text-main)', font: '700 11px "DM Mono", monospace' }}>
                          3. Batch Preview & Validation ({parsedBulkStudents.length} Records)
                        </label>
                        <span className={invalidBulkCount === 0 ? 'bulk-badge-valid' : 'bulk-badge-invalid'}>
                          {invalidBulkCount === 0 ? `ALL ${validBulkCount} VALID & READY` : `${validBulkCount} VALID · ${invalidBulkCount} ISSUES`}
                        </span>
                      </div>

                      <div className="bulk-preview-wrap" style={{ maxHeight: '320px', overflowX: 'auto', overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                          <thead>
                            <tr style={{ background: 'var(--panel-subtle)', color: 'var(--brand-primary)', borderBottom: '1px solid var(--line)', position: 'sticky', top: 0, zIndex: 2 }}>
                              <th style={{ padding: '8px 10px', textAlign: 'left' }}>#</th>
                              <th style={{ padding: '8px 10px', textAlign: 'left' }}>FULL NAME</th>
                              <th style={{ padding: '8px 10px', textAlign: 'left' }}>ROLL NUMBER / MEMBER ID</th>
                              <th style={{ padding: '8px 10px', textAlign: 'left' }}>PASSWORD</th>
                              <th style={{ padding: '8px 10px', textAlign: 'left' }}>GENDER</th>
                              <th style={{ padding: '8px 10px', textAlign: 'left' }}>DEPARTMENT & YEAR</th>
                              <th style={{ padding: '8px 10px', textAlign: 'left' }}>ASSIGNED ROLE</th>
                              <th style={{ padding: '8px 10px', textAlign: 'left' }}>STATUS</th>
                            </tr>
                          </thead>
                          <tbody>
                            {parsedBulkStudents.map(s => (
                              <tr key={s.index} style={{ borderBottom: '1px solid var(--line)', background: s.isValid ? 'transparent' : 'rgba(239, 68, 68, 0.08)' }}>
                                <td style={{ padding: '6px 10px', color: 'var(--text-dim)' }}>{s.index}</td>
                                <td style={{ padding: '6px 10px', color: 'var(--text-main)', fontWeight: 600 }}>{s.name || '<Empty>'}</td>
                                <td style={{ padding: '6px 10px', color: 'var(--brand-primary)', fontFamily: 'monospace', fontWeight: 700 }}>{s.memberId || '<Empty>'}</td>
                                <td style={{ padding: '6px 10px', color: 'var(--text-dim)', fontFamily: 'monospace' }}>
                                  {s.password ? `${s.password.slice(0, 4)}••••` : '<Missing>'}
                                </td>
                                <td style={{ padding: '6px 10px' }}>
                                  <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: s.gender === 'FEMALE' ? 'rgba(236, 72, 153, 0.12)' : 'rgba(59, 130, 246, 0.12)', color: s.gender === 'FEMALE' ? '#ec4899' : '#3b82f6' }}>
                                    {s.gender || 'MALE'}
                                  </span>
                                </td>
                                <td style={{ padding: '6px 10px', color: 'var(--text-muted)', fontSize: '10px' }}>{s.department} · Y{s.year}</td>
                                <td style={{ padding: '6px 10px' }}>
                                  <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'var(--panel-subtle)', color: 'var(--brand-primary)', border: '1px solid var(--line)' }}>
                                    {s.role}
                                  </span>
                                </td>
                                <td style={{ padding: '6px 10px' }}>
                                  {s.isValid ? (
                                    <span style={{ color: '#059669', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                      ✓ Ready
                                    </span>
                                  ) : (
                                    <span style={{ color: '#dc2626', fontWeight: 600 }}>{s.errors.join(', ')}</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button
                      type="submit"
                      className="primary"
                      disabled={bulkSubmitting || validBulkCount === 0}
                      style={{ flex: 1, minHeight: '44px', fontSize: '12px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                      {bulkSubmitting ? 'PROVISIONING ACCOUNTS…' : `⚡ PROVISION ${validBulkCount} ACCOUNTS`}
                    </button>
                    <button
                      type="button"
                      className="outline"
                      onClick={() => setManagementView('ROSTER')}
                      style={{ minHeight: '44px', padding: '0 20px' }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}
          </article>
        ) : (
          /* Full-Width Member List Directory Card */
          <article className="member-list-card" style={{ width: '100%' }}>
            <div className="card-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
              <div>
                <p className="eyebrow">ROSTER DIRECTORY</p>
                <h2>Active Member Accounts ({members.length})</h2>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="primary"
                  onClick={() => setManagementView('CREATE')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '6px 14px' }}
                >
                  <IconUserSvg size={14} /> ＋ ADD MEMBER
                </button>
                <button
                  type="button"
                  className="outline"
                  onClick={handleDownloadMembersCsv}
                  disabled={filteredMembers.length === 0}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '6px 12px' }}
                  title="Download filtered members list as CSV"
                >
                  <IconDownload size={14} /> DOWNLOAD CSV
                </button>
              </div>
            </div>

            {/* Filter and Search Bar Row */}
            <div style={{ marginTop: '16px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 280px' }}>
                <input
                  style={{ width: '100%', height: '40px', padding: '0 14px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)', fontSize: '12px' }}
                  placeholder="Search by Member ID, Roll Number, Name, Role, Dept, or Email..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Role Filter Chips */}
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={`tab-btn ${roleFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => setRoleFilter('ALL')}
                  style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '6px', background: roleFilter === 'ALL' ? 'var(--brand-glow)' : 'transparent', color: roleFilter === 'ALL' ? 'var(--brand-primary)' : 'var(--text-muted)', border: roleFilter === 'ALL' ? '1px solid var(--brand-primary)' : '1px solid var(--line)' }}
                >
                  All ({members.length})
                </button>
                <button
                  type="button"
                  className={`tab-btn ${roleFilter === 'STUDENT' ? 'active' : ''}`}
                  onClick={() => setRoleFilter('STUDENT')}
                  style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '6px', background: roleFilter === 'STUDENT' ? 'var(--brand-glow)' : 'transparent', color: roleFilter === 'STUDENT' ? 'var(--brand-primary)' : 'var(--text-muted)', border: roleFilter === 'STUDENT' ? '1px solid var(--brand-primary)' : '1px solid var(--line)' }}
                >
                  Students ({members.filter(m => m.role === 'STUDENT').length})
                </button>
                <button
                  type="button"
                  className={`tab-btn ${roleFilter === 'ADMIN' ? 'active' : ''}`}
                  onClick={() => setRoleFilter('ADMIN')}
                  style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '6px', background: roleFilter === 'ADMIN' ? 'var(--brand-glow)' : 'transparent', color: roleFilter === 'ADMIN' ? 'var(--brand-primary)' : 'var(--text-muted)', border: roleFilter === 'ADMIN' ? '1px solid var(--brand-primary)' : '1px solid var(--line)' }}
                >
                  Leaders & Admins ({members.filter(m => m.role !== 'STUDENT').length})
                </button>
                <button
                  type="button"
                  className={`tab-btn ${roleFilter === '2FA' ? 'active' : ''}`}
                  onClick={() => setRoleFilter('2FA')}
                  style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '6px', background: roleFilter === '2FA' ? 'var(--brand-glow)' : 'transparent', color: roleFilter === '2FA' ? 'var(--brand-primary)' : 'var(--text-muted)', border: roleFilter === '2FA' ? '1px solid var(--brand-primary)' : '1px solid var(--line)' }}
                >
                  2FA Active ({members.filter(m => m.twoFactorEnabled).length})
                </button>
              </div>
            </div>

            {loading ? (
              <p className="directory-state" style={{ marginTop: '24px' }}>Loading accounts...</p>
            ) : filteredMembers.length === 0 ? (
              <p className="directory-state" style={{ marginTop: '24px' }}>No matching members found.</p>
            ) : (
              <div className="table-scroll-container" style={{ marginTop: '16px' }}>
                <div className="members-table">
                  <div className="table-header">
                    <span>MEMBER &amp; ROLL NO</span>
                    <span>{isMrdu ? 'MRDU ROLE & 2FA' : 'CLUB ROLE & 2FA'}</span>
                    <span>DEPARTMENT &amp; YEAR</span>
                    <span>CONTACT INFO</span>
                    <span>ACTIONS</span>
                  </div>
                  {filteredMembers.map(m => {
                    const isEditing = editingId === m.id
                    return (
                      <div className={`table-row ${isEditing ? 'editing' : ''}`} key={m.id} style={isEditing ? { gridTemplateColumns: '1fr' } : undefined}>
                        {isEditing ? (
                          <div>
                            <div className="edit-fields-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                              <input
                                placeholder="Name"
                                defaultValue={m.name}
                                onChange={e => setEditData(d => ({ ...d, name: e.target.value }))}
                              />
                              <input
                                placeholder="Email"
                                defaultValue={m.email || ''}
                                onChange={e => setEditData(d => ({ ...d, email: e.target.value }))}
                              />
                              <input
                                placeholder="Phone"
                                defaultValue={m.phone || ''}
                                onChange={e => setEditData(d => ({ ...d, phone: e.target.value }))}
                              />
                              <select
                                defaultValue={m.role}
                                onChange={e => setEditData(d => ({ ...d, role: e.target.value }))}
                                disabled={m.isPrimaryAdmin}
                              >
                                {CLUB_ROLES.map(r => (
                                  <option key={r.id} value={r.id}>{r.label}</option>
                                ))}
                              </select>
                            </div>
                            <div className="action-buttons" style={{ marginTop: '10px' }}>
                              <button className="action-btn save-btn" onClick={() => updateMember(m.id)}>Save {isMrdu ? 'MRDU Role' : 'Club Role'}</button>
                              <button className="action-btn cancel-btn" onClick={() => { setEditingId(null); setEditData({}) }}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {/* Member & Roll No */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                              {m.profileImage ? (
                                <img src={m.profileImage} alt={m.name} style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid var(--brand-border-subtle)', flexShrink: 0 }} />
                              ) : (
                                <span style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(82, 187, 245, 0.22), rgba(20, 80, 140, 0.4))', display: 'grid', placeItems: 'center', color: 'var(--brand-primary)', font: '700 12px Syne', border: '1.5px solid var(--brand-border-subtle)', flexShrink: 0 }}>
                                  {m.initials || m.name?.slice(0, 2).toUpperCase() || 'ID'}
                                </span>
                              )}
                              <div style={{ minWidth: 0, overflow: 'hidden' }}>
                                <b style={{ color: 'var(--text-main)', fontSize: '13px', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</b>
                                <span style={{ color: 'var(--brand-primary)', font: '700 11px "DM Mono", monospace', display: 'block' }}>{m.memberId}</span>
                                {(m.rollNumber || m.profile?.rollNumber) && (
                                  <small style={{ color: 'var(--text-dim)', fontSize: '10.5px', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Roll: {m.rollNumber || m.profile?.rollNumber}</small>
                                )}
                              </div>
                            </div>

                            {/* Role & 2FA */}
                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                                <span className={`badge ${m.isPrimaryAdmin ? 'badge-president' : m.role === 'STUDENT' ? 'badge-student' : 'badge-admin'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                                  {m.isPrimaryAdmin ? <><IconCrown size={12} /> PRESIDENT</> : getRoleLabel(m.role)}
                                </span>
                                {m.twoFactorEnabled && (
                                  <span className="badge badge-active" style={{ fontSize: '9px', display: 'inline-flex', alignItems: 'center', gap: '3px', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.3)', whiteSpace: 'nowrap' }}>
                                    <Icon8 name="authentication" size={10} /> 2FA ON
                                  </span>
                                )}
                              </div>
                              {!m.isPrimaryAdmin && (
                                <small style={{ color: 'var(--text-dim)', fontSize: '10.5px', display: 'block', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {isMrdu
                                    ? `CSC: ${getRoleLabel(m.cscRole || 'STUDENT')}`
                                    : `MRDU: ${getRoleLabel(m.mrduRole || 'STUDENT')}`}
                                </small>
                              )}
                            </div>

                            {/* Department & Academic Year */}
                            <div style={{ minWidth: 0 }}>
                              <span style={{ color: 'var(--text-main)', fontSize: '12px', fontWeight: 600, display: 'block', lineHeight: 1.3, wordBreak: 'break-word' }}>
                                {m.department || m.profile?.department || 'General'}
                              </span>
                              <small style={{ color: 'var(--text-dim)', fontSize: '11px', display: 'block', marginTop: '3px' }}>
                                {m.year || m.profile?.year ? `Year ${m.year || m.profile?.year}` : 'Undergraduate'}
                              </small>
                            </div>

                            {/* Contact Info (Properly separated, never squished!) */}
                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: m.email ? 'var(--text-main)' : 'var(--text-dim)', fontSize: '11.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                <IconMail size={12} style={{ flexShrink: 0, color: 'var(--brand-primary)' }} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.email || 'No email provided'}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: m.phone ? 'var(--text-muted)' : 'var(--text-dim)', fontSize: '11px', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                <IconHeadset size={12} style={{ flexShrink: 0, color: 'var(--text-dim)' }} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.phone || 'No phone provided'}</span>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="action-buttons" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', justifyContent: 'flex-start', minWidth: 0 }}>
                              {m.isPrimaryAdmin && !user.isPrimaryAdmin ? (
                                <span style={{ fontSize: '10.5px', color: '#ffd54f', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.4)', padding: '5px 12px', borderRadius: '6px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                                  🛡️ IMMUTABLE PROTECTED
                                </span>
                              ) : (
                                <>
                                  <button className="action-btn edit-btn" onClick={() => { setEditingId(m.id); setEditData({}) }} title="Edit profile information" style={{ whiteSpace: 'nowrap' }}>Edit</button>
                                  {m.id !== user.id && (
                                    <button
                                      type="button"
                                      className="action-btn"
                                      onClick={() => handleSwitchToMember(m)}
                                      title={`Switch into ${m.name}'s account (${m.memberId})`}
                                      style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.4)', fontWeight: 700, whiteSpace: 'nowrap' }}
                                    >
                                      ⇄ Switch
                                    </button>
                                  )}
                                  {m.role !== 'STUDENT' && !m.isPrimaryAdmin && (
                                    <button
                                      className="action-btn"
                                      onClick={() => onNavigate('admin-coordinator')}
                                      title="Open Coordinator Console"
                                      style={{ background: 'rgba(82, 187, 245, 0.15)', color: 'var(--brand-primary)', borderColor: 'var(--brand-border-subtle)', whiteSpace: 'nowrap' }}
                                    >
                                      🛡️ Coordinator Hub
                                    </button>
                                  )}
                                  <button className="action-btn toggle-status-btn" onClick={() => toggleStatus(m)} disabled={m.isPrimaryAdmin} title="Toggle account activation" style={{ whiteSpace: 'nowrap' }}>
                                    {m.accountStatus === 'ACTIVE' ? 'Active' : 'Disabled'}
                                  </button>
                                  <button className="action-btn edit-btn" onClick={() => setResetModalUser(m)} disabled={m.isPrimaryAdmin && !user.isPrimaryAdmin} title="Reset member password" style={{ whiteSpace: 'nowrap' }}>Password</button>
                                  {m.twoFactorEnabled && (
                                    <button className="action-btn cancel-btn" onClick={() => handleDisable2FA(m)} disabled={m.isPrimaryAdmin && !user.isPrimaryAdmin} title="Disable 2FA if member is locked out" style={{ whiteSpace: 'nowrap' }}>
                                      Reset 2FA
                                    </button>
                                  )}
                                  {!m.isPrimaryAdmin && (
                                    <button className="action-btn delete-btn" onClick={() => removeMember(m)} title="Permanently delete account" style={{ whiteSpace: 'nowrap' }}>Delete</button>
                                  )}
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </article>
        )}

        {/* Reset Password Modal */}
        {resetModalUser && (
          <div className="photo-lightbox" onClick={() => { if (!resetSubmitting) setResetModalUser(null) }}>
            <div className="photo-lightbox-content" onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-modal)', padding: '28px', borderRadius: '12px', border: '1px solid var(--line)', maxWidth: '440px', width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ margin: 0, font: '700 18px Syne', color: 'var(--text-main)' }}>Reset Member Password</h3>
                <button type="button" className="lightbox-close" onClick={() => setResetModalUser(null)} style={{ position: 'static' }}>✕</button>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '0 0 16px' }}>
                Resetting password for: <b style={{ color: 'var(--brand-primary)' }}>{resetModalUser.name}</b> (<span style={{ color: '#059669', fontFamily: 'DM Mono' }}>{resetModalUser.memberId}</span>)
              </p>

              <form onSubmit={handleAdminResetPassword}>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  New Password (12+ characters, uppercase, lowercase, number, symbol) *
                </label>
                <div style={{ position: 'relative', marginBottom: '12px' }}>
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    placeholder="Enter or generate new password"
                    value={newPasswordInput}
                    onChange={e => setNewPasswordInput(e.target.value)}
                    style={{ width: '100%', height: '42px', padding: '0 40px 0 12px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text-main)', fontSize: '13px', fontFamily: showResetPassword ? 'DM Mono, monospace' : 'inherit' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--brand-primary)', cursor: 'pointer', fontSize: '11px', padding: '4px' }}
                    title={showResetPassword ? 'Hide password' : 'Show password'}
                  >
                    {showResetPassword ? 'Hide' : 'Show'}
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="outline"
                    onClick={handleGenerateAdminPassword}
                    style={{ fontSize: '11px', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Icon8 name="keySecurity" size={13} /> Generate Strong Password
                  </button>
                  {newPasswordInput && (
                    <button
                      type="button"
                      className="outline"
                      onClick={handleCopyResetPassword}
                      style={{ fontSize: '11px', padding: '5px 10px', color: resetCopied ? '#059669' : 'var(--brand-primary)', borderColor: resetCopied ? '#059669' : 'var(--line)' }}
                    >
                      <IconCopy size={11} /> {resetCopied ? 'Copied!' : 'Copy'}
                    </button>
                  )}
                </div>

                {resetError && <p className="member-form-error" style={{ marginBottom: '14px' }}>{resetError}</p>}

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="button" className="action-btn cancel-btn" disabled={resetSubmitting} onClick={() => setResetModalUser(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="primary" disabled={resetSubmitting || !newPasswordInput} style={{ minHeight: '36px' }}>
                    {resetSubmitting ? 'UPDATING…' : 'RESET PASSWORD'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Transfer Leadership Modal */}
        {transferModalOpen && (
          <div className="photo-lightbox" onClick={() => setTransferModalOpen(false)}>
            <div className="photo-lightbox-content" onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-modal)', padding: '28px', borderRadius: '12px', border: '1px solid #f59e0b', maxWidth: '460px' }}>
              <h3 style={{ margin: '0 0 8px', font: '700 18px Syne', color: '#d97706' }}>Transfer Primary Leadership</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '0 0 16px' }}>
                Select the administrator who will become the new Primary President.
              </p>
              <form onSubmit={handleTransferLeadership}>
                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '11px', marginBottom: '6px' }}>
                  Select New Primary President
                  <select
                    className="member-select"
                    required
                    value={transferTargetId}
                    onChange={e => setTransferTargetId(e.target.value)}
                    style={{ marginBottom: '14px' }}
                  >
                    <option value="">-- Choose Administrator --</option>
                    {members.filter(m => !m.isPrimaryAdmin && m.role !== 'STUDENT').map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({m.memberId} · {getRoleLabel(m.role)})</option>
                    ))}
                  </select>
                </label>
                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '11px', marginBottom: '6px' }}>
                  Your 6-Digit Master Security PIN or Password
                  <input
                    required
                    placeholder="Enter Security PIN or Password"
                    value={transferAuthCode}
                    onChange={e => setTransferAuthCode(e.target.value)}
                    style={{ width: '100%', height: '40px', padding: '0 12px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text-main)', marginBottom: '14px' }}
                  />
                </label>
                {transferError && <p className="member-form-error">{transferError}</p>}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="button" className="action-btn cancel-btn" onClick={() => setTransferModalOpen(false)}>Cancel</button>
                  <button type="submit" className="primary" style={{ minHeight: '36px', background: 'linear-gradient(105deg,#f59e0b,#d97706)' }}>
                    CONFIRM TRANSFER
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Bulk Account Creation Results Modal */}
        {bulkResultModal && (
          <div className="photo-lightbox" onClick={() => setBulkResultModal(null)}>
            <div className="guest-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
              <button className="lightbox-close" onClick={() => setBulkResultModal(null)}>✕</button>
              <h3 style={{ color: 'var(--text-main)', font: '700 20px Syne', margin: '0 0 8px' }}>
                Batch Account Creation Results
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '0 0 16px' }}>
                {bulkResultModal.message}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div style={{ background: 'var(--panel-subtle)', border: '1px solid rgba(5, 150, 105, 0.3)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                  <span style={{ color: '#059669', fontSize: '24px', fontWeight: 700, display: 'block' }}>{bulkResultModal.successCount}</span>
                  <small style={{ color: 'var(--brand-primary)', font: '600 10px "DM Mono", monospace' }}>SUCCESSFULLY CREATED</small>
                </div>
                <div style={{ background: bulkResultModal.failedCount > 0 ? '#fee2e2' : 'var(--panel-subtle)', border: bulkResultModal.failedCount > 0 ? '1px solid #fca5a5' : '1px solid var(--line)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                  <span style={{ color: bulkResultModal.failedCount > 0 ? '#b91c1c' : 'var(--text-dim)', fontSize: '24px', fontWeight: 700, display: 'block' }}>{bulkResultModal.failedCount}</span>
                  <small style={{ color: 'var(--text-muted)', font: '600 10px "DM Mono", monospace' }}>FAILED / SKIPPED</small>
                </div>
              </div>

              {bulkResultModal.failedItems && bulkResultModal.failedItems.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ color: '#b91c1c', font: '600 11px "DM Mono", monospace', display: 'block', marginBottom: '6px' }}>
                    FAILED STUDENT RECORDS ({bulkResultModal.failedItems.length})
                  </label>
                  <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #fca5a5', borderRadius: '6px', background: 'var(--bg-input)' }}>
                    <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#fee2e2', color: '#b91c1c', borderBottom: '1px solid #fca5a5' }}>
                          <th style={{ padding: '6px 10px', textAlign: 'left' }}>ROW</th>
                          <th style={{ padding: '6px 10px', textAlign: 'left' }}>ROLL NO / MEMBER ID</th>
                          <th style={{ padding: '6px 10px', textAlign: 'left' }}>NAME</th>
                          <th style={{ padding: '6px 10px', textAlign: 'left' }}>REASON</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkResultModal.failedItems.map((f, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--line)' }}>
                            <td style={{ padding: '6px 10px', color: 'var(--brand-primary)' }}>#{f.row}</td>
                            <td style={{ padding: '6px 10px', color: 'var(--text-main)', fontFamily: 'monospace' }}>{f.memberId}</td>
                            <td style={{ padding: '6px 10px', color: 'var(--text-muted)' }}>{f.name}</td>
                            <td style={{ padding: '6px 10px', color: '#b91c1c' }}>{f.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <button className="primary" type="button" onClick={() => setBulkResultModal(null)} style={{ width: '100%', height: '42px', fontSize: '11px' }}>
                CLOSE SUMMARY
              </button>
            </div>
          </div>
        )}
      </section>
    </LivePortal>
  )
}

// ----------------------------------------------------
// Dedicated Student Coordinator & Leadership Console
// ----------------------------------------------------
function CoordinatorConsole({ user, logout, onNavigate }) {
  const { platformMode } = usePlatformTheme()
  const isMrdu = platformMode === 'MRDU_EVENTS'
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [activeView, setActiveView] = useState('matrix') // 'matrix' | 'squads'
  const [savingId, setSavingId] = useState(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const CAPABILITIES = [
    { key: 'QR_PASSES_VIEW', label: 'Pass Scanner', short: '🎟️ Scanner', desc: 'Scan and check-in attendee QR passes at venue gates', squadTitle: '🎟️ Gate Entry & Pass Scanner Squad', color: '#10b981' },
    { key: 'EVENT_MANAGE', label: 'Event Studio', short: '📅 Events', desc: 'Create, edit, schedule, and publish events & hackathons', squadTitle: '📅 Event Creators & Workshop Managers', color: '#52bbf5' },
    { key: 'PAYMENTS_VERIFY', label: 'Verify Payments', short: '💰 Payments', desc: 'Verify UPI UTR numbers and activate paid passes', squadTitle: '💰 Finance & UPI Payment Verifiers', color: '#f59e0b' },
    { key: 'ACCOUNT_MANAGEMENT', label: 'Member Admin', short: '👥 Members', desc: 'Provision and manage student accounts and member roster', squadTitle: '👥 Member Directory & Account Administrators', color: '#8b5cf6' },
    { key: 'GALLERY_MANAGE', label: 'Gallery Studio', short: '📸 Gallery', desc: 'Upload event photo albums and manage gallery', squadTitle: '📸 Photo Gallery & Media Managers', color: '#ec4899' },
    { key: 'REELS_MANAGE', label: 'Reels Studio', short: '🎬 Reels', desc: 'Upload, curate, and publish short video reels to feed', squadTitle: '🎬 Campus Reels & Video Creators', color: '#06b6d4' },
    { key: 'REGISTRATIONS_VIEW', label: 'Attendee Rosters', short: '📊 Rosters', desc: 'View event registrants, track attendance, export CSV', squadTitle: '📊 Attendance & Registration Officers', color: '#6366f1' },
    { key: 'CHAT_USE', label: 'Live Chat', short: '💬 Chat', desc: 'Send official council broadcasts and live club chat', squadTitle: '💬 Official Communicators & Announcers', color: '#14b8a6' },
    { key: 'SETTINGS_MANAGE', label: 'Platform Settings', short: '⚙️ Settings', desc: 'Configure platform rules, switches, and club settings', squadTitle: '⚙️ System & Platform Administrators', color: '#64748b' },
  ]

  function loadMembers() {
    setLoading(true)
    adminApi.listMembers()
      .then(res => setMembers(res.members || []))
      .catch(err => setError(err.message || 'Failed to load leaders.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadMembers()
  }, [])

  const leaders = useMemo(() => {
    return members.filter(m => m.role !== 'STUDENT')
  }, [members])

  const filteredLeaders = useMemo(() => {
    return leaders.filter(m => {
      const q = search.trim().toLowerCase()
      const matchesSearch = !q ||
        (m.name || '').toLowerCase().includes(q) ||
        (m.memberId || '').toLowerCase().includes(q) ||
        (m.role || '').toLowerCase().includes(q) ||
        (m.department || '').toLowerCase().includes(q)
      const matchesRole = roleFilter === 'ALL' || m.role === roleFilter
      return matchesSearch && matchesRole
    })
  }, [leaders, search, roleFilter])

  function getLeaderPerms(leader) {
    const existing = (leader.permissions || []).map(p => (typeof p === 'string' ? p : p.permission))
    const defaults = ROLE_DEFAULT_PERMISSIONS[leader.role] || []
    return Array.from(new Set([...defaults, ...existing]))
  }

  async function togglePermission(leader, permKey) {
    if (leader.isPrimaryAdmin) {
      setError('Primary President permissions cannot be altered.')
      return
    }
    const current = getLeaderPerms(leader)
    const next = current.includes(permKey)
      ? current.filter(p => p !== permKey)
      : [...current, permKey]

    if (next.length === 0) {
      setError('A leader must have at least one assigned capability.')
      return
    }

    setSavingId(leader.id)
    setError('')
    setMessage('')
    try {
      await adminApi.updateMemberPermissions(leader.id, next)
      setMembers(prev => prev.map(m => (m.id === leader.id ? { ...m, permissions: next } : m)))
      setMessage(`✓ Updated access for ${leader.name} (${leader.memberId})`)
    } catch (err) {
      setError(err.message || 'Failed to update permission.')
    } finally {
      setSavingId(null)
    }
  }

  async function applyPreset(leader, presetType) {
    if (leader.isPrimaryAdmin) {
      setError('Primary President permissions cannot be altered.')
      return
    }
    let perms = []
    if (presetType === 'SCANNER') perms = ['QR_PASSES_VIEW', 'EVENTS_VIEW', 'DASHBOARD_VIEW']
    if (presetType === 'EVENTS') perms = ['EVENT_MANAGE', 'EVENTS_VIEW', 'QR_PASSES_VIEW', 'REGISTRATIONS_VIEW', 'DASHBOARD_VIEW']
    if (presetType === 'FINANCE') perms = ['PAYMENTS_VERIFY', 'PAYMENTS_VIEW', 'REGISTRATIONS_VIEW', 'DASHBOARD_VIEW']
    if (presetType === 'MEDIA') perms = ['GALLERY_MANAGE', 'REELS_MANAGE', 'GALLERY_VIEW', 'EVENTS_VIEW', 'DASHBOARD_VIEW']
    if (presetType === 'FULL') perms = CAPABILITIES.map(p => p.key)
    if (presetType === 'DEFAULT') perms = ROLE_DEFAULT_PERMISSIONS[leader.role] || ['DASHBOARD_VIEW']

    setSavingId(leader.id)
    setError('')
    setMessage('')
    try {
      await adminApi.updateMemberPermissions(leader.id, perms)
      setMembers(prev => prev.map(m => (m.id === leader.id ? { ...m, permissions: perms } : m)))
      setMessage(`✓ Applied ${presetType} preset to ${leader.name}!`)
    } catch (err) {
      setError(err.message || 'Failed to apply preset.')
    } finally {
      setSavingId(null)
    }
  }

  const [activatingAll, setActivatingAll] = useState(false)

  async function handleActivateAll() {
    setActivatingAll(true)
    setMessage('')
    setError('')
    try {
      const res = await adminApi.activateAllAccounts()
      setMembers(prev => prev.map(m => ({ ...m, accountStatus: 'ACTIVE' })))
      setMessage(res.message || '✓ All accounts have been activated successfully!')
    } catch (err) {
      setError(err.message || 'Failed to activate accounts.')
    } finally {
      setActivatingAll(false)
    }
  }

  const scannerCount = leaders.filter(l => getLeaderPerms(l).includes('QR_PASSES_VIEW')).length
  const eventCount = leaders.filter(l => getLeaderPerms(l).includes('EVENT_MANAGE')).length
  const financeCount = leaders.filter(l => getLeaderPerms(l).includes('PAYMENTS_VERIFY')).length
  const mediaCount = leaders.filter(l => getLeaderPerms(l).includes('GALLERY_MANAGE') || getLeaderPerms(l).includes('REELS_MANAGE')).length

  return (
    <LivePortal user={user} logout={logout} activeTab="admin-coordinator" onNavigate={onNavigate} title="COORDINATOR CONSOLE">
      <section className="member-management" style={{ maxWidth: '1440px', margin: '0 auto' }}>
        <div className="member-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate('admin-dashboard')}>
              ← BACK TO DASHBOARD
            </button>
            <p className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <IconShieldCheck size={14} /> STUDENT COORDINATOR OPERATIONS HUB
            </p>
            <h1>Coordinator Console & Leader Access Control</h1>
            <p>Directly manage operational permissions and delegate squad roles across all club leaders.</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="primary"
              onClick={handleActivateAll}
              disabled={activatingAll}
              style={{
                fontSize: '11px',
                padding: '7px 14px',
                background: '#10b981',
                borderColor: '#059669',
                color: '#fff',
                fontWeight: 700,
              }}
              title="Activate all club accounts immediately in 1 click"
            >
              ⚡ {activatingAll ? 'ACTIVATING ALL…' : 'ACTIVATE ALL ACCOUNTS'}
            </button>
            <button
              type="button"
              className="outline"
              onClick={loadMembers}
              disabled={loading}
              style={{ fontSize: '11px', padding: '7px 14px' }}
            >
              ↻ Refresh Roster
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => onNavigate('admin-members')}
              style={{ fontSize: '11px', padding: '7px 14px' }}
            >
              Member Directory →
            </button>
          </div>
        </div>

        {/* Operational Squad Stats Bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          <div style={{ background: 'var(--panel-subtle)', border: '1px solid var(--line)', borderRadius: '10px', padding: '14px 16px' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>Active Leaders</span>
            <b style={{ color: 'var(--text-main)', fontSize: '24px', display: 'block', marginTop: '2px' }}>{leaders.length}</b>
            <small style={{ color: 'var(--brand-primary)', fontSize: '10.5px' }}>Club Officers & Leads</small>
          </div>

          <div style={{ background: 'var(--panel-subtle)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '10px', padding: '14px 16px' }}>
            <span style={{ color: '#10b981', fontSize: '11px', fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>🎟️ Gate Scanner Squad</span>
            <b style={{ color: '#10b981', fontSize: '24px', display: 'block', marginTop: '2px' }}>{scannerCount}</b>
            <small style={{ color: 'var(--text-muted)', fontSize: '10.5px' }}>Authorized for Entry Gates</small>
          </div>

          <div style={{ background: 'var(--panel-subtle)', border: '1px solid rgba(82, 187, 245, 0.3)', borderRadius: '10px', padding: '14px 16px' }}>
            <span style={{ color: 'var(--brand-primary)', fontSize: '11px', fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>📅 Event Studio Leads</span>
            <b style={{ color: 'var(--brand-primary)', fontSize: '24px', display: 'block', marginTop: '2px' }}>{eventCount}</b>
            <small style={{ color: 'var(--text-muted)', fontSize: '10.5px' }}>Can Publish Events</small>
          </div>

          <div style={{ background: 'var(--panel-subtle)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '10px', padding: '14px 16px' }}>
            <span style={{ color: '#f59e0b', fontSize: '11px', fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>💰 Finance & UTR Leads</span>
            <b style={{ color: '#f59e0b', fontSize: '24px', display: 'block', marginTop: '2px' }}>{financeCount}</b>
            <small style={{ color: 'var(--text-muted)', fontSize: '10.5px' }}>Payment Verification</small>
          </div>

          <div style={{ background: 'var(--panel-subtle)', border: '1px solid rgba(236, 72, 153, 0.3)', borderRadius: '10px', padding: '14px 16px' }}>
            <span style={{ color: '#ec4899', fontSize: '11px', fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>🎬 Media & Reels Team</span>
            <b style={{ color: '#ec4899', fontSize: '24px', display: 'block', marginTop: '2px' }}>{mediaCount}</b>
            <small style={{ color: 'var(--text-muted)', fontSize: '10.5px' }}>Gallery & Video Feed</small>
          </div>
        </div>

        {message && <p className="member-form-success" style={{ marginBottom: '14px' }}>{message}</p>}
        {error && <p className="member-form-error" style={{ marginBottom: '14px' }}>{error}</p>}

        {/* View Switcher: Matrix vs Squads */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div className="member-view-switcher" style={{ margin: 0 }}>
            <button
              type="button"
              className={activeView === 'matrix' ? 'primary active' : 'outline'}
              onClick={() => setActiveView('matrix')}
              style={{ fontSize: '11.5px', padding: '8px 16px' }}
            >
              📊 All-in-One Leader Matrix ({filteredLeaders.length})
            </button>
            <button
              type="button"
              className={activeView === 'squads' ? 'primary active' : 'outline'}
              onClick={() => setActiveView('squads')}
              style={{ fontSize: '11.5px', padding: '8px 16px' }}
            >
              ⚡ Delegate by Squad / Capability
            </button>
          </div>

          {/* Search & Filter */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Search leader by name, roll no, role…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '250px', fontSize: '12px', padding: '7px 12px' }}
            />
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              style={{ fontSize: '12px', padding: '7px 12px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text-main)' }}
            >
              <option value="ALL">All Roles ({leaders.length})</option>
              <option value="STUDENT_COORDINATOR">Student Coordinator</option>
              <option value="PRESIDENT">President</option>
              <option value="VICE_PRESIDENT">Vice President</option>
              <option value="SECRETARY">Secretary</option>
              <option value="TREASURER">Treasurer</option>
              <option value="EVENT_MANAGEMENT">Event Management</option>
              <option value="TECHNICAL_LEAD">Technical Lead</option>
              <option value="MEDIA_LEAD">Media Lead</option>
              <option value="PR_TEAM">PR Team</option>
              <option value="SECURITY_LEAD">Security Lead</option>
            </select>
          </div>
        </div>

        {loading ? (
          <p className="directory-state">Loading leadership team and permissions…</p>
        ) : filteredLeaders.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', background: 'var(--panel-subtle)', borderRadius: '10px', border: '1px solid var(--line)' }}>
            <p style={{ color: 'var(--text-muted)' }}>No leaders matching search criteria.</p>
          </div>
        ) : activeView === 'matrix' ? (
          /* View 1: Comprehensive All-in-One Leader Access Matrix */
          <div style={{ background: 'var(--panel-subtle)', border: '1px solid var(--line)', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-input)', borderBottom: '1px solid var(--line)' }}>
                    <th style={{ padding: '12px 14px', color: 'var(--text-main)', fontWeight: 700, minWidth: '180px' }}>LEADER / COORDINATOR</th>
                    <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'center', minWidth: '85px' }}>🎟️ SCANNER</th>
                    <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'center', minWidth: '85px' }}>📅 EVENTS</th>
                    <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'center', minWidth: '85px' }}>💰 FINANCE</th>
                    <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'center', minWidth: '85px' }}>👥 MEMBERS</th>
                    <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'center', minWidth: '85px' }}>📸 GALLERY</th>
                    <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'center', minWidth: '85px' }}>🎬 REELS</th>
                    <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'center', minWidth: '85px' }}>📊 ROSTER</th>
                    <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'center', minWidth: '85px' }}>💬 CHAT</th>
                    <th style={{ padding: '12px 14px', color: 'var(--text-main)', fontWeight: 700, minWidth: '220px' }}>1-CLICK PRESETS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeaders.map(leader => {
                    const activePerms = getLeaderPerms(leader)
                    const isSaving = savingId === leader.id
                    const isProtected = leader.isPrimaryAdmin

                    return (
                      <tr
                        key={leader.id}
                        style={{
                          borderBottom: '1px solid var(--line)',
                          background: isSaving ? 'rgba(82, 187, 245, 0.08)' : 'transparent',
                          transition: 'background 0.2s ease',
                        }}
                      >
                        {/* Leader Info */}
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, rgba(82, 187, 245, 0.25), rgba(20, 80, 140, 0.4))',
                              display: 'grid',
                              placeItems: 'center',
                              color: 'var(--brand-primary)',
                              font: '700 11px Syne',
                              flexShrink: 0,
                            }}>
                              {leader.initials || leader.name?.slice(0, 2).toUpperCase() || 'LD'}
                            </span>
                            <div>
                              <b style={{ color: 'var(--text-main)', fontSize: '12px', display: 'block' }}>
                                {leader.name}
                              </b>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                <small style={{ color: 'var(--brand-primary)', fontSize: '10px', fontFamily: 'monospace' }}>
                                  {leader.memberId}
                                </small>
                                <span className="badge" style={{ fontSize: '9px', padding: '1px 5px' }}>
                                  {getRoleLabel(leader.role)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Direct Toggle Buttons for each Capability */}
                        {CAPABILITIES.filter(c => c.key !== 'SETTINGS_MANAGE').map(cap => {
                          const isEnabled = activePerms.includes(cap.key)
                          return (
                            <td key={cap.key} style={{ padding: '8px', textAlign: 'center' }}>
                              {isProtected ? (
                                <span style={{ color: '#10b981', fontSize: '14px', fontWeight: 800 }}>✓</span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isSaving}
                                  onClick={() => togglePermission(leader, cap.key)}
                                  title={`Click to ${isEnabled ? 'revoke' : 'grant'} ${cap.label} for ${leader.name}`}
                                  style={{
                                    width: '34px',
                                    height: '34px',
                                    borderRadius: '8px',
                                    border: isEnabled ? `1.5px solid ${cap.color}` : '1px solid var(--line)',
                                    background: isEnabled ? `${cap.color}22` : 'var(--bg-input)',
                                    color: isEnabled ? cap.color : 'var(--text-dim)',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 700,
                                    fontSize: '13px',
                                    transition: 'all 0.15s ease',
                                  }}
                                >
                                  {isEnabled ? '✓' : '·'}
                                </button>
                              )}
                            </td>
                          )
                        })}

                        {/* 1-Click Presets */}
                        <td style={{ padding: '8px 14px' }}>
                          {isProtected ? (
                            <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontSize: '10px', padding: '4px 8px' }}>
                              🛡️ IMMUTABLE PROTECTED
                            </span>
                          ) : (
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                className="outline"
                                disabled={isSaving}
                                onClick={() => applyPreset(leader, 'SCANNER')}
                                title="Grant Scanner & Entry rights only"
                                style={{ fontSize: '9.5px', padding: '3px 6px', lineHeight: 1 }}
                              >
                                🎟️ Scan
                              </button>
                              <button
                                type="button"
                                className="outline"
                                disabled={isSaving}
                                onClick={() => applyPreset(leader, 'EVENTS')}
                                title="Grant Event Studio & Scheduling rights"
                                style={{ fontSize: '9.5px', padding: '3px 6px', lineHeight: 1 }}
                              >
                                📅 Event
                              </button>
                              <button
                                type="button"
                                className="outline"
                                disabled={isSaving}
                                onClick={() => applyPreset(leader, 'FINANCE')}
                                title="Grant Payment Verification rights"
                                style={{ fontSize: '9.5px', padding: '3px 6px', lineHeight: 1 }}
                              >
                                💰 Pay
                              </button>
                              <button
                                type="button"
                                className="outline"
                                disabled={isSaving}
                                onClick={() => applyPreset(leader, 'MEDIA')}
                                title="Grant Gallery & Reels rights"
                                style={{ fontSize: '9.5px', padding: '3px 6px', lineHeight: 1 }}
                              >
                                📸 Media
                              </button>
                              <button
                                type="button"
                                className="outline"
                                disabled={isSaving}
                                onClick={() => applyPreset(leader, 'FULL')}
                                title="Grant all operational permissions"
                                style={{ fontSize: '9.5px', padding: '3px 6px', lineHeight: 1, borderColor: 'var(--brand-primary)', color: 'var(--brand-primary)' }}
                              >
                                ⭐ Full
                              </button>
                              <button
                                type="button"
                                className="outline"
                                disabled={isSaving}
                                onClick={() => applyPreset(leader, 'DEFAULT')}
                                title="Reset to role default"
                                style={{ fontSize: '9.5px', padding: '3px 6px', lineHeight: 1, color: 'var(--text-dim)' }}
                              >
                                ↺ Reset
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* View 2: Squad-by-Squad Delegation Cards (No Need to Select Each Person!) */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
            {CAPABILITIES.map(cap => {
              const assignedLeaders = leaders.filter(l => getLeaderPerms(l).includes(cap.key))

              return (
                <div
                  key={cap.key}
                  style={{
                    background: 'var(--panel-subtle)',
                    border: `1px solid ${cap.color}44`,
                    borderRadius: '12px',
                    padding: '20px',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', borderBottom: '1px solid var(--line)', paddingBottom: '12px' }}>
                    <div>
                      <b style={{ color: cap.color, fontSize: '13.5px', display: 'block' }}>
                        {cap.squadTitle}
                      </b>
                      <small style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block', marginTop: '3px' }}>
                        {cap.desc}
                      </small>
                    </div>
                    <span className="badge" style={{ background: `${cap.color}22`, color: cap.color, fontSize: '11px', padding: '3px 8px', fontWeight: 700 }}>
                      {assignedLeaders.length} ACTIVE
                    </span>
                  </div>

                  {/* Leader Checklist for this squad */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', overflowY: 'auto' }}>
                    {leaders.map(leader => {
                      const isAssigned = getLeaderPerms(leader).includes(cap.key)
                      const isProtected = leader.isPrimaryAdmin
                      const isSaving = savingId === leader.id

                      return (
                        <div
                          key={leader.id}
                          onClick={() => {
                            if (!isProtected && !isSaving) togglePermission(leader, cap.key)
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: isAssigned ? `1px solid ${cap.color}66` : '1px solid var(--line)',
                            background: isAssigned ? `${cap.color}11` : 'var(--bg-input)',
                            cursor: isProtected ? 'default' : 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                            <span style={{
                              width: '26px',
                              height: '26px',
                              borderRadius: '50%',
                              background: 'var(--line)',
                              display: 'grid',
                              placeItems: 'center',
                              fontSize: '10px',
                              fontWeight: 700,
                              color: 'var(--text-main)',
                              flexShrink: 0,
                            }}>
                              {leader.initials || leader.name?.slice(0, 2).toUpperCase()}
                            </span>
                            <div style={{ minWidth: 0, overflow: 'hidden' }}>
                              <span style={{ color: 'var(--text-main)', fontSize: '11.5px', fontWeight: 600, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {leader.name}
                              </span>
                              <small style={{ color: 'var(--text-dim)', fontSize: '10px' }}>
                                {getRoleLabel(leader.role)} · {leader.memberId}
                              </small>
                            </div>
                          </div>

                          <div>
                            {isProtected ? (
                              <span style={{ color: '#10b981', fontSize: '11px', fontWeight: 700 }}>IMMUTABLE</span>
                            ) : (
                              <span style={{
                                display: 'inline-block',
                                width: '38px',
                                height: '22px',
                                borderRadius: '12px',
                                background: isAssigned ? cap.color : 'var(--line)',
                                position: 'relative',
                                transition: 'background 0.2s ease',
                              }}>
                                <span style={{
                                  position: 'absolute',
                                  top: '2px',
                                  left: isAssigned ? '18px' : '2px',
                                  width: '18px',
                                  height: '18px',
                                  borderRadius: '50%',
                                  background: '#fff',
                                  transition: 'left 0.2s ease',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                                }} />
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </LivePortal>
  )
}

// ----------------------------------------------------
// Universal Member Profile Management (Students & Admins)
// ----------------------------------------------------
function UniversalProfileView({ user, logout, onNavigate, onProfileUpdated }) {
  const { platformMode } = usePlatformTheme()
  const isMrdu = platformMode === 'MRDU_EVENTS'
  const [profile, setProfile] = useState(user.profile || {})
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [photoPreview, setPhotoPreview] = useState(user.profile?.profileImage || '')
  const [copiedId, setCopiedId] = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setMessage('')
    setError('')

    const rawAge = String(form.get('age') || '').trim()
    const payload = {
      name: String(form.get('name') || '').trim() || undefined,
      gender: String(form.get('gender') || 'MALE'),
      age: rawAge ? Number(rawAge) : null,
      phone: String(form.get('phone') || '').trim() || null,
      bio: String(form.get('bio') || '').trim() || null,
      instagramUrl: String(form.get('instagramUrl') || '').trim() || null,
      githubUrl: String(form.get('githubUrl') || '').trim() || null,
      linkedinUrl: String(form.get('linkedinUrl') || '').trim() || null,
      portfolioUrl: String(form.get('portfolioUrl') || '').trim() || null,
      skills: String(form.get('skills') || '').trim() || null,
      profileImage: photoPreview || null,
    }

    setSubmitting(true)
    try {
      const res = await memberApi.updateProfile(payload)
      setProfile(res.user.profile || {})
      if (onProfileUpdated) onProfileUpdated(res.user)
      setMessage('✓ Profile and avatar updated successfully! Changes are live across the portal.')
    } catch (err) {
      setError(err.message || 'Failed to save profile.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleCopyMemberId() {
    navigator.clipboard.writeText(user.memberId)
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 2000)
  }

  return (
    <LivePortal user={user} logout={logout} activeTab={user.isAdminUser ? 'admin-profile' : 'student-profile'} onNavigate={onNavigate} title="MY PROFILE">
      <section className="member-management">
        <div className="member-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate(user.isAdminUser ? 'admin-dashboard' : 'student-dashboard')}>
              ← BACK TO DASHBOARD
            </button>
            <p className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Icon8 name="fingerprint" size={14} /> OFFICIAL CREDENTIALS & ID STUDIO
            </p>
            <h1>Personal Profile & Digital Identity</h1>
            <p>Customize your member badge, bio, developer portfolio links, and cyber security skills.</p>
          </div>
          <button
            type="button"
            onClick={handleCopyMemberId}
            className="president-lock"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', background: 'var(--panel-subtle)' }}
            title="Click to copy Member ID"
          >
            <Icon8 name="idDocs" size={14} />
            MEMBER ID: {user.memberId} {copiedId ? '(COPIED!)' : ''}
          </button>
        </div>

        {message && <p className="member-form-success">{message}</p>}
        {error && <p className="member-form-error">{error}</p>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '24px', alignItems: 'start' }}>
          {/* Left Column: Comprehensive Profile Editor */}
          <article className="account-form-card" style={{ padding: '24px' }}>
            <form onSubmit={handleSave}>
              {/* Photo Uploader Header Box */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '22px', padding: '16px', background: 'var(--bg-input)', borderRadius: '12px', border: '1px solid var(--line)' }}>
                {photoPreview ? (
                  <img src={photoPreview} alt="Profile" style={{ width: '84px', height: '84px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--brand-primary)', boxShadow: '0 4px 14px rgba(0,0,0,0.15)' }} />
                ) : (
                  <div style={{ width: '84px', height: '84px', borderRadius: '50%', background: 'var(--brand-gradient)', display: 'grid', placeItems: 'center', color: 'var(--brand-text)', font: '700 28px Syne', boxShadow: '0 4px 14px rgba(0,0,0,0.15)' }}>
                    {user.initials}
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <b style={{ color: 'var(--text-main)', fontSize: '15px', display: 'block' }}>Avatar & Photo</b>
                  <p style={{ color: 'var(--text-muted)', fontSize: '11px', margin: '2px 0 10px' }}>Upload a JPEG or PNG photo to display on your digital ID.</p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <label className="action-btn edit-btn" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '6px 12px' }}>
                      <IconUpload size={13} /> Change Photo
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={e => {
                          const file = e.target.files?.[0]
                          if (file) readImageFile(file, setPhotoPreview)
                        }}
                      />
                    </label>
                    {photoPreview && (
                      <button type="button" className="action-btn cancel-btn" onClick={() => setPhotoPreview('')} style={{ fontSize: '11px', padding: '6px 12px' }}>
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Personal & Academic Details */}
              <p className="eyebrow" style={{ margin: '0 0 12px', fontSize: '10px' }}>PERSONAL & CONTACT INFO</p>
              <div className="member-form-grid" style={{ marginBottom: '20px' }}>
                <label>
                  Full Name *
                  <input name="name" defaultValue={profile.name || user.name} required />
                </label>
                <label>
                  Phone Number
                  <input name="phone" defaultValue={profile.phone || ''} placeholder="e.g. +91 9876543210" />
                </label>
                <label>
                  Gender
                  <select className="member-select" name="gender" defaultValue={profile.gender || 'MALE'}>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </label>
                <label>
                  Age
                  <input name="age" type="number" min={15} max={65} defaultValue={profile.age || ''} placeholder="Age (e.g. 20)" />
                </label>
              </div>

              {/* Bio & Skills */}
              <p className="eyebrow" style={{ margin: '0 0 12px', fontSize: '10px' }}>ABOUT & TECHNICAL EXPERTISE</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                    Short Bio
                  </label>
                  <input name="bio" defaultValue={profile.bio || ''} placeholder="e.g. Reverse engineering, ethical hacking & CTF enthusiast" style={{ width: '100%', height: '40px', padding: '0 12px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                    Key Cyber Security & Technical Skills
                  </label>
                  <input name="skills" defaultValue={profile.skills || ''} placeholder="e.g. Wireshark, Metasploit, Python, Burp Suite, Network Forensics" style={{ width: '100%', height: '40px', padding: '0 12px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)' }} />
                </div>
              </div>

              {/* Online Links */}
              <p className="eyebrow" style={{ margin: '0 0 12px', fontSize: '10px' }}>ONLINE PORTFOLIOS & PROFILES</p>
              <div className="member-form-grid" style={{ marginBottom: '20px' }}>
                <label>
                  GitHub URL
                  <input name="githubUrl" defaultValue={profile.githubUrl || ''} placeholder="https://github.com/..." />
                </label>
                <label>
                  LinkedIn URL
                  <input name="linkedinUrl" defaultValue={profile.linkedinUrl || ''} placeholder="https://linkedin.com/in/..." />
                </label>
                <label>
                  Instagram Handle / URL
                  <input name="instagramUrl" defaultValue={profile.instagramUrl || ''} placeholder="https://instagram.com/..." />
                </label>
                <label>
                  Portfolio Website
                  <input name="portfolioUrl" defaultValue={profile.portfolioUrl || ''} placeholder="https://..." />
                </label>
              </div>

              <button className="primary member-submit" type="submit" disabled={submitting} style={{ width: '100%', height: '44px', fontWeight: 700 }}>
                {submitting ? 'SAVING PROFILE…' : 'SAVE PROFILE & UPDATE ID CARD'}
              </button>
            </form>
          </article>

          {/* Right Column: Holographic Digital ID Card & Quick Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', position: 'sticky', top: '20px' }}>
            <article className="account-form-card" style={{ padding: '24px', textAlign: 'center', background: 'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-portal) 100%)', border: '1.5px solid var(--brand-border-subtle)', borderRadius: '18px', boxShadow: '0 12px 35px rgba(0,0,0,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <span className="platform-active-pill" style={{ fontSize: '9px' }}>
                  OFFICIAL ID PASS
                </span>
                <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontSize: '9px', fontWeight: 700 }}>
                  ● ACTIVE MEMBER
                </span>
              </div>

              {/* Digital Badge Card Canvas */}
              <div style={{ padding: '24px 16px', background: 'var(--bg-input)', borderRadius: '16px', border: '1px solid var(--line)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'var(--brand-gradient)' }} />

                {photoPreview ? (
                  <img src={photoPreview} alt="Profile" style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--brand-primary)', margin: '0 auto 14px', display: 'block', boxShadow: '0 6px 20px rgba(0,0,0,0.2)' }} />
                ) : (
                  <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'var(--brand-gradient)', display: 'grid', placeItems: 'center', color: 'var(--brand-text)', font: '700 32px Syne', margin: '0 auto 14px', boxShadow: '0 6px 20px rgba(0,0,0,0.2)' }}>
                    {user.initials}
                  </div>
                )}

                <h3 style={{ margin: '0 0 4px', font: '700 20px Syne', color: 'var(--text-main)' }}>
                  {profile.name || user.name}
                </h3>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', margin: '6px 0 12px', flexWrap: 'wrap' }}>
                  <span className={`badge ${user.isPrimaryAdmin ? 'badge-president' : user.role === 'STUDENT' ? 'badge-student' : 'badge-admin'}`} style={{ fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    {user.isPrimaryAdmin ? <><IconCrown size={12} /> PRESIDENT</> : getRoleLabel(user.role)}
                  </span>
                  <span className="badge" style={{ background: 'var(--panel-subtle)', color: 'var(--brand-primary)', fontSize: '10px', fontFamily: 'DM Mono' }}>
                    {user.memberId}
                  </span>
                </div>

                <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.5, margin: '0 0 14px', padding: '0 8px' }}>
                  {profile.bio || `${isMrdu ? 'MRDU Events' : 'Cyber Security Club'} authorized student member.`}
                </p>

                {profile.skills && (
                  <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '14px' }}>
                    {profile.skills.split(/[,;]/).slice(0, 4).map((skill, idx) => (
                      <span key={idx} style={{ fontSize: '9px', padding: '2px 8px', borderRadius: '4px', background: 'var(--panel-subtle)', border: '1px solid var(--line)', color: 'var(--text-main)', fontFamily: 'DM Mono' }}>
                        {skill.trim()}
                      </span>
                    ))}
                  </div>
                )}

                <div style={{ borderTop: '1px dashed var(--line)', paddingTop: '12px', display: 'flex', justifyContent: 'space-around', fontSize: '11px', color: 'var(--text-dim)' }}>
                  <div>
                    <small style={{ display: 'block', fontSize: '9px' }}>DEPARTMENT</small>
                    <b style={{ color: 'var(--text-main)' }}>{user.profile?.department || 'CSE / Cyber'}</b>
                  </div>
                  <div>
                    <small style={{ display: 'block', fontSize: '9px' }}>YEAR</small>
                    <b style={{ color: 'var(--text-main)' }}>Year {user.profile?.year || '1'}</b>
                  </div>
                  <div>
                    <small style={{ display: 'block', fontSize: '9px' }}>2FA LOCK</small>
                    <b style={{ color: user.twoFactorEnabled ? '#10b981' : '#f59e0b' }}>{user.twoFactorEnabled ? 'ENFORCED' : 'OPTIONAL'}</b>
                  </div>
                </div>
              </div>

              {/* Quick Profile Actions */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '16px' }}>
                <button
                  type="button"
                  className="outline"
                  onClick={() => onNavigate('security')}
                  style={{ fontSize: '11px', padding: '8px 12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <Icon8 name="password" size={13} /> Account Security
                </button>
                <button
                  type="button"
                  className="outline"
                  onClick={() => onNavigate(user.isAdminUser ? 'admin-passes' : 'student-passes')}
                  style={{ fontSize: '11px', padding: '8px 12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <Icon8 name="faceId" size={13} /> Event Passes
                </button>
              </div>
            </article>
          </div>
        </div>
      </section>
    </LivePortal>
  )
}

// ----------------------------------------------------
// Student & Admin Customer Support / Doubts Desk
// ----------------------------------------------------
function SupportDeskView({ user, logout, onNavigate }) {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [submittingReply, setSubmittingReply] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newTaggedRole, setNewTaggedRole] = useState('PRESIDENT')
  const [newSubject, setNewSubject] = useState('')
  const [newMessage, setNewMessage] = useState('')
  const [submittingTicket, setSubmittingTicket] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const isStudent = user.role === 'STUDENT'
  const isPresident = user.isPrimaryAdmin || user.role === 'PRESIDENT'

  function loadTickets() {
    setLoading(true)
    const apiCall = isStudent ? memberApi.listSupportTickets() : adminApi.listSupportTickets()
    apiCall
      .then(res => setTickets(res.tickets || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadTickets()
  }, [])

  async function handleCreateTicket(e) {
    e.preventDefault()
    setSubmittingTicket(true)
    setError('')
    setMessage('')
    try {
      const res = await memberApi.createSupportTicket({
        taggedRole: newTaggedRole,
        subject: newSubject,
        message: newMessage,
      })
      setTickets(c => [res.ticket, ...c])
      setShowCreateModal(false)
      setNewSubject('')
      setNewMessage('')
      setMessage(`Doubt submitted for @${newTaggedRole}. Leadership will respond shortly.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmittingTicket(false)
    }
  }

  async function handleSendReply(e) {
    e.preventDefault()
    if (!selectedTicket || !replyText.trim()) return
    setSubmittingReply(true)
    setError('')
    try {
      const apiCall = isStudent
        ? memberApi.replySupportTicket(selectedTicket.id, replyText)
        : adminApi.replySupportTicket(selectedTicket.id, replyText)

      const res = await apiCall
      const updatedTicket = {
        ...selectedTicket,
        status: res.status || selectedTicket.status,
        replies: [...(selectedTicket.replies || []), res.reply],
      }
      setSelectedTicket(updatedTicket)
      setTickets(c => c.map(t => (t.id === selectedTicket.id ? updatedTicket : t)))
      setReplyText('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmittingReply(false)
    }
  }

  async function handleToggleStatus(ticket, newStatus) {
    try {
      const res = await adminApi.updateSupportTicketStatus(ticket.id, newStatus)
      const updated = { ...ticket, status: newStatus }
      setSelectedTicket(s => (s?.id === ticket.id ? updated : s))
      setTickets(c => c.map(t => (t.id === ticket.id ? updated : t)))
    } catch (err) {
      setError(err.message)
    }
  }

  // Permission to reply: Student can reply to own ticket; Admin can reply ONLY if President or matching taggedRole
  const canReply = isStudent
    ? selectedTicket?.userId === user.id
    : isPresident || user.role === selectedTicket?.taggedRole

  function handleDownloadSupportCsv() {
    const headers = [
      'Ticket ID',
      'Created Date',
      'Student Name',
      'Member ID',
      'Tagged Role',
      'Subject / Topic',
      'Status',
      'Initial Message',
      'Replies Count',
    ]
    const rows = tickets.map(t => [
      t.id,
      t.createdAt ? new Date(t.createdAt).toLocaleString() : null,
      t.user?.profile?.name || t.user?.name,
      t.user?.memberId,
      getRoleLabel(t.taggedRole),
      t.subject,
      t.status,
      t.message,
      t.replies?.length || 0,
    ])
    downloadCsv('support_inquiries_report.csv', headers, rows)
  }

  return (
    <LivePortal user={user} logout={logout} activeTab={isStudent ? 'student-support' : 'admin-support'} onNavigate={onNavigate} title="HELPDESK & DOUBTS">
      <section className="member-management">
        <div className="member-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate(isStudent ? 'student-dashboard' : 'admin-dashboard')}>
              ← COMMAND CENTER
            </button>
            <p className="eyebrow">COMMUNITY SERVICE & QUERIES</p>
            <h1>Student Helpdesk & Query Desk</h1>
            <p>Direct question & answer channel between student members and specialized club council leads.</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {!isStudent && (
              <button
                type="button"
                className="outline"
                onClick={handleDownloadSupportCsv}
                disabled={tickets.length === 0}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '6px 12px' }}
                title="Download support inquiries as CSV"
              >
                <IconDownload size={14} /> DOWNLOAD QUERIES CSV
              </button>
            )}
            {isStudent && (
              <button className="primary" type="button" onClick={() => setShowCreateModal(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '14px', lineHeight: 1 }}>+</span> ASK A DOUBT / QUERY
              </button>
            )}
          </div>
        </div>

        {message && <p className="member-form-success">{message}</p>}
        {error && <p className="member-form-error">{error}</p>}

        <div className="member-management-grid">
          {/* Tickets List */}
          <article className="member-list-card">
            <div className="card-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <p className="eyebrow">INQUIRY QUEUE</p>
                <h2>{isStudent ? 'My Support Queries' : isPresident ? 'All Student Inquiries' : `@${user.role} Inquiries`} ({tickets.length})</h2>
              </div>
            </div>

            {loading ? (
              <p className="directory-state">Loading support inquiries...</p>
            ) : tickets.length === 0 ? (
              <p className="directory-state">No inquiries recorded. {isStudent ? 'Have a doubt? Click "Ask a Doubt" above.' : 'No doubts pending for your role.'}</p>
            ) : (
              <div className="ticket-list" style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {tickets.map(t => {
                  const isSelected = selectedTicket?.id === t.id
                  return (
                    <div
                      key={t.id}
                      className={`ticket-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedTicket(t)}
                      style={{
                        padding: '14px',
                        borderRadius: '10px',
                        background: isSelected ? 'var(--brand-badge-bg)' : 'var(--panel-subtle)',
                        border: isSelected ? '1px solid var(--brand-primary)' : '1px solid var(--line)',
                        cursor: 'pointer',
                        transition: 'border-color 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <div>
                          <span className="badge" style={{ background: 'var(--brand-badge-bg)', color: 'var(--brand-badge-color)', border: '1px solid var(--brand-border-subtle)', fontSize: '9px', marginRight: '6px' }}>
                            @{t.taggedRole}
                          </span>
                          <span className={`badge badge-${t.status.toLowerCase()}`}>
                            {t.status}
                          </span>
                        </div>
                        <small style={{ color: 'var(--text-dim)', font: '500 9px "DM Mono", monospace' }}>
                          {new Date(t.createdAt).toLocaleDateString()}
                        </small>
                      </div>
                      <h4 style={{ margin: '8px 0 4px', font: '700 14px Syne', color: 'var(--text-main)' }}>{t.subject}</h4>
                      <p style={{ color: 'var(--text-muted)', fontSize: '11px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.message}
                      </p>
                      <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <small style={{ color: 'var(--text-dim)' }}>From: {t.user?.profile?.name || t.user?.memberId}</small>
                        <small style={{ color: 'var(--brand-primary)' }}>{t.replies?.length || 0} replies →</small>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </article>

          {/* Ticket Conversation Thread */}
          <article className="account-form-card" style={{ display: 'flex', flexDirection: 'column', minHeight: '480px' }}>
            {selectedTicket ? (
              <>
                <div style={{ borderBottom: '1px solid var(--line)', paddingBottom: '14px', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                    <div>
                      <span className="badge" style={{ background: 'var(--brand-badge-bg)', color: 'var(--brand-badge-color)', border: '1px solid var(--brand-border-subtle)', fontSize: '10px', marginRight: '8px' }}>
                        TAGGED: @{selectedTicket.taggedRole}
                      </span>
                      <span className={`badge badge-${selectedTicket.status.toLowerCase()}`}>
                        {selectedTicket.status}
                      </span>
                      <h3 style={{ margin: '8px 0 4px', font: '700 18px Syne', color: 'var(--text-main)' }}>{selectedTicket.subject}</h3>
                      <small style={{ color: 'var(--text-dim)' }}>
                        Asked by: <b style={{ color: 'var(--brand-primary)' }}>{selectedTicket.user?.profile?.name || selectedTicket.user?.memberId}</b> on {new Date(selectedTicket.createdAt).toLocaleString()}
                      </small>
                    </div>
                    {!isStudent && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {selectedTicket.status !== 'RESOLVED' ? (
                          <button type="button" className="action-btn save-btn" onClick={() => handleToggleStatus(selectedTicket, 'RESOLVED')}>
                            Mark Resolved
                          </button>
                        ) : (
                          <button type="button" className="action-btn cancel-btn" onClick={() => handleToggleStatus(selectedTicket, 'OPEN')}>
                            Re-Open
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <p style={{ color: 'var(--text-main)', fontSize: '13px', lineHeight: '1.6', margin: '12px 0 0', padding: '12px', background: 'var(--panel-subtle)', borderRadius: '8px', border: '1px solid var(--line)' }}>
                    {selectedTicket.message}
                  </p>
                </div>

                {/* Conversation Chat Bubbles */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '4px', marginBottom: '14px' }}>
                  {(!selectedTicket.replies || selectedTicket.replies.length === 0) ? (
                    <p className="directory-state" style={{ margin: 'auto' }}>No responses yet. Awaiting leader response.</p>
                  ) : (
                    selectedTicket.replies.map(r => {
                      const isMe = r.userId === user.id
                      const replierRole = r.user?.role
                      const isReplierPresident = r.user?.isPrimaryAdmin || replierRole === 'PRESIDENT'
                      return (
                        <div
                          key={r.id}
                          style={{
                            alignSelf: isMe ? 'flex-end' : 'flex-start',
                            maxWidth: '85%',
                            padding: '12px 16px',
                            borderRadius: '12px',
                            background: isMe ? 'var(--brand-badge-bg)' : 'var(--panel-elevated)',
                            border: isReplierPresident ? '1px solid #f59e0b' : isMe ? '1px solid var(--brand-border-subtle)' : '1px solid var(--line)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            <b style={{ color: isReplierPresident ? '#d97706' : 'var(--brand-primary)', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              {isReplierPresident && <IconCrown size={12} />}
                              {r.user?.profile?.name || r.user?.name || r.user?.memberId}
                            </b>
                            <span className="badge" style={{ fontSize: '8px', padding: '2px 6px' }}>
                              {isReplierPresident ? 'PRESIDENT' : getRoleLabel(replierRole)}
                            </span>
                            <small style={{ color: 'var(--text-dim)', fontSize: '9px', marginLeft: 'auto' }}>
                              {new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </small>
                          </div>
                          <p style={{ color: 'var(--text-main)', fontSize: '12px', margin: 0, lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                            {r.message}
                          </p>
                        </div>
                      )
                    })
                  )}
                </div>

                {/* Reply Box */}
                {canReply ? (
                  <form onSubmit={handleSendReply} style={{ display: 'flex', gap: '10px' }}>
                    <input
                      placeholder={`Type response as ${user.name} (${getRoleLabel(user.role)})...`}
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      style={{ flex: 1, height: '42px', padding: '0 14px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)', fontSize: '12px' }}
                    />
                    <button className="primary" disabled={submittingReply || !replyText.trim()} style={{ minHeight: '42px', padding: '0 18px' }}>
                      {submittingReply ? 'SENDING…' : 'REPLY →'}
                    </button>
                  </form>
                ) : (
                  <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', fontSize: '11px', textAlign: 'center' }}>
                    Role Restriction: Only members of <b>@{selectedTicket.taggedRole}</b> or the President are authorized to reply to this query.
                  </div>
                )}
              </>
            ) : (
              <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)' }}>
                <p>Select any doubt inquiry from the left to view the thread and respond.</p>
              </div>
            )}
          </article>
        </div>

        {/* Ask a Doubt Modal (Student) */}
        {showCreateModal && (
          <div className="photo-lightbox" onClick={() => setShowCreateModal(false)}>
            <div className="photo-lightbox-content" onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-modal)', padding: '28px', borderRadius: '14px', border: '1px solid var(--line)', maxWidth: '520px', width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ margin: 0, font: '700 20px Syne', color: 'var(--text-main)' }}>Ask a Doubt / Query</h3>
                  <small style={{ color: 'var(--text-muted)' }}>Tag a specific club leadership council team</small>
                </div>
                <button className="lightbox-close" onClick={() => setShowCreateModal(false)} style={{ position: 'static' }}>✕</button>
              </div>

              <form onSubmit={handleCreateTicket}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Tag Club Council Role *
                  <select
                    className="member-select"
                    value={newTaggedRole}
                    onChange={e => setNewTaggedRole(e.target.value)}
                    style={{ marginBottom: '14px' }}
                  >
                    <option value="PRESIDENT">@PRESIDENT (Executive Leadership)</option>
                    <option value="VICE_PRESIDENT">@VICE_PRESIDENT (Operations)</option>
                    <option value="TECH_TEAM">@TECH_TEAM (Labs, CTF, Hacking Tools)</option>
                    <option value="EVENT_MANAGEMENT">@EVENT_MANAGEMENT (Passes, Workshops)</option>
                    <option value="TREASURER">@TREASURER (Payments & Membership)</option>
                    <option value="MEDIA_LEAD">@MEDIA_LEAD (Gallery & Creative)</option>
                    <option value="PR_TEAM">@PR_TEAM (Outreach & Communication)</option>
                    <option value="CULTURAL">@CULTURAL (Events & Festivities)</option>
                    <option value="SECRETARY">@SECRETARY (Documentation & Notices)</option>
                  </select>
                </label>

                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Subject / Question Topic *
                  <input
                    required
                    placeholder="e.g. Query regarding upcoming Wireshark lab requirements"
                    value={newSubject}
                    onChange={e => setNewSubject(e.target.value)}
                    style={{ width: '100%', height: '40px', padding: '0 12px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text-main)', marginBottom: '14px' }}
                  />
                </label>

                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Description / Details *
                  <textarea
                    required
                    placeholder="Explain your doubt in detail..."
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    style={{ width: '100%', height: '90px', padding: '10px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text-main)', marginBottom: '16px', resize: 'none' }}
                  />
                </label>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="button" className="action-btn cancel-btn" onClick={() => setShowCreateModal(false)}>Cancel</button>
                  <button type="submit" className="primary" disabled={submittingTicket}>
                    {submittingTicket ? 'SUBMITTING…' : 'SUBMIT DOUBT INQUIRY'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </section>
    </LivePortal>
  )
}

// ----------------------------------------------------
// Subscription Management (Admin)
// ----------------------------------------------------
function SubscriptionManagement({ user, logout, onNavigate }) {
  const [subscriptions, setSubscriptions] = useState([])
  const [stats, setStats] = useState({ totalStudents: 0, activeSubscriptions: 0, pendingVerification: 0, expiredSubscriptions: 0, rejectedPayments: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [filter, setFilter] = useState('ALL')
  const [searchTerm, setSearchTerm] = useState('')
  const [viewingReceipt, setViewingReceipt] = useState(null)
  const [rejectingSub, setRejectingSub] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('')

  function loadData() {
    setLoading(true)
    adminApi.listSubscriptions()
      .then(res => {
        setSubscriptions(res.subscriptions || [])
        setStats(res.stats || {})
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleVerify(id) {
    setError('')
    setMessage('')
    try {
      await adminApi.verifySubscription(id)
      setMessage('Subscription verified and activated successfully until the end of the month.')
      loadData()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleReject() {
    if (!rejectingSub) return
    setError('')
    setMessage('')
    try {
      await adminApi.rejectSubscription(rejectingSub.id, rejectionReason)
      setMessage('Subscription payment rejected.')
      setRejectingSub(null)
      setRejectionReason('')
      loadData()
    } catch (err) {
      setError(err.message)
    }
  }

  const filtered = subscriptions.filter(sub => {
    if (filter === 'PENDING' && sub.status !== 'PENDING') return false
    if (filter === 'ACTIVE' && sub.status !== 'ACTIVE') return false
    if (filter === 'EXPIRED' && sub.status !== 'EXPIRED') return false
    if (filter === 'REJECTED' && sub.status !== 'REJECTED') return false
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      const matchId = sub.memberId.toLowerCase().includes(term)
      const matchName = sub.name.toLowerCase().includes(term)
      const matchRef = sub.transactionRef.toLowerCase().includes(term)
      if (!matchId && !matchName && !matchRef) return false
    }
    return true
  })

  function handleDownloadSubscriptionsCsv() {
    const headers = [
      'Subscription ID',
      'Member ID',
      'Student Name',
      'Roll Number',
      'Department / Branch',
      'Academic Year',
      'Official Email',
      'Phone Number',
      'Amount (₹)',
      'Status',
      'Transaction UTR / Ref',
      'Submission Date',
      'Verification Date',
      'Expiry Date',
      'Rejection Reason',
    ]
    const rows = filtered.map(s => [
      s.id,
      s.memberId,
      s.name,
      s.rollNumber || s.memberId,
      s.department,
      s.year,
      s.email,
      s.phone,
      Number(s.amount || 0),
      s.status,
      s.transactionRef,
      s.submittedAt ? new Date(s.submittedAt).toLocaleString() : null,
      s.verifiedAt ? new Date(s.verifiedAt).toLocaleString() : null,
      s.expiresAt ? new Date(s.expiresAt).toLocaleDateString() : null,
      s.rejectionReason,
    ])
    downloadCsv('student_subscriptions_export.csv', headers, rows)
  }

  return (
    <LivePortal user={user} logout={logout} activeTab="admin-subscriptions" onNavigate={onNavigate} title="STUDENT SUBSCRIPTIONS">
      <section className="member-management">
        <div className="member-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate('admin-dashboard')}>
              ← COMMAND CENTER
            </button>
            <p className="eyebrow">STUDENT MEMBERSHIP FEE</p>
            <h1>Subscription Management</h1>
            <p>Review, verify, and track monthly student membership payments.</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              className="outline"
              onClick={handleDownloadSubscriptionsCsv}
              disabled={filtered.length === 0}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '6px 12px' }}
              title="Download subscriptions list as CSV"
            >
              <IconDownload size={14} /> DOWNLOAD SUBSCRIPTIONS CSV
            </button>
            <button className="outline" type="button" onClick={() => onNavigate('admin-settings')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
              <Icon8 name="keySecurity" size={14} /> SUBSCRIPTION SETTINGS
            </button>
          </div>
        </div>

        {message && <p className="member-form-success">{message}</p>}
        {error && <p className="member-form-error">{error}</p>}

        {/* Top Statistics Cards */}
        <div className="sub-stats-grid">
          <div className="sub-stat-card blue">
            <i><Icon8 name="idDocs" size={22} /></i>
            <div>
              <p>TOTAL STUDENTS</p>
              <b>{stats.totalStudents || 0}</b>
            </div>
          </div>
          <div className="sub-stat-card green">
            <i><Icon8 name="authentication" size={22} /></i>
            <div>
              <p>ACTIVE SUBSCRIPTIONS</p>
              <b>{stats.activeSubscriptions || 0}</b>
            </div>
          </div>
          <div className="sub-stat-card amber">
            <i><Icon8 name="realtime" size={22} /></i>
            <div>
              <p>PENDING VERIFICATION</p>
              <b>{stats.pendingVerification || 0}</b>
            </div>
          </div>
          <div className="sub-stat-card purple">
            <i><Icon8 name="protect" size={22} /></i>
            <div>
              <p>EXPIRED SUBSCRIPTIONS</p>
              <b>{stats.expiredSubscriptions || 0}</b>
            </div>
          </div>
          <div className="sub-stat-card red">
            <i><Icon8 name="captcha" size={22} /></i>
            <div>
              <p>REJECTED PAYMENTS</p>
              <b>{stats.rejectedPayments || stats.rejectedCount || 0}</b>
            </div>
          </div>
        </div>

        {/* Pending Indicator Banner */}
        {stats.pendingVerification > 0 && (
          <div className="pending-alert-banner">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <IconAlertTriangle size={20} />
              <div>
                <b>{stats.pendingVerification} payments waiting for verification</b>
                <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#ffecb3' }}>
                  Student members are waiting for membership activation.
                </p>
              </div>
            </div>
            <button type="button" onClick={() => setFilter('PENDING')}>
              REVIEW PAYMENTS →
            </button>
          </div>
        )}

        {/* Filter Controls & Submissions Table */}
        <article className="member-list-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div className="audit-tabs" style={{ borderBottom: 0, margin: 0, padding: 0 }}>
              {['ALL', 'PENDING', 'ACTIVE', 'EXPIRED', 'REJECTED'].map(f => (
                <button
                  key={f}
                  type="button"
                  className={`audit-tab-btn ${filter === f ? 'active' : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {f} {f === 'PENDING' && stats.pendingVerification > 0 ? `(${stats.pendingVerification})` : ''}
                </button>
              ))}
            </div>
            <input
              style={{ height: '36px', padding: '0 12px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text-main)', fontSize: '11px', minWidth: '240px' }}
              placeholder="Search by ID, Name, or UTR Ref..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          {loading ? (
            <p className="directory-state">Loading subscription submissions...</p>
          ) : filtered.length === 0 ? (
            <p className="directory-state">No subscription records match your criteria.</p>
          ) : (
            <div className="table-scroll-container">
              <div className="sub-table">
                <div className="sub-table-header">
                  <span>STUDENT</span>
                  <span>AMOUNT / REF</span>
                  <span>SUBMITTED</span>
                  <span>RECEIPT</span>
                  <span>STATUS / EXPIRY</span>
                  <span>ACTIONS</span>
                </div>
                {filtered.map(sub => (
                  <div className="sub-table-row" key={sub.id}>
                    <div>
                      <b>{sub.name}</b>
                      <small style={{ color: 'var(--brand-primary)', display: 'block' }}>{sub.memberId}</small>
                    </div>
                    <div>
                      <strong style={{ color: '#059669' }}>₹{sub.amount.toFixed(2)}</strong>
                      <small style={{ color: 'var(--text-muted)', display: 'block' }}>Ref: {sub.transactionRef}</small>
                    </div>
                    <div>
                      <small>{new Date(sub.submittedAt).toLocaleDateString()}</small>
                      <small style={{ color: 'var(--text-dim)', display: 'block' }}>{new Date(sub.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                    </div>
                    <div>
                      {sub.receiptImage ? (
                        <img
                          className="receipt-thumb"
                          src={sub.receiptImage}
                          alt="Payment Receipt"
                          onClick={() => setViewingReceipt(sub.receiptImage)}
                          title="Click to view full receipt"
                        />
                      ) : (
                        <small style={{ color: 'var(--text-dim)' }}>No receipt</small>
                      )}
                    </div>
                    <div>
                      <span className={`badge badge-${sub.status.toLowerCase()}`}>
                        {sub.status}
                      </span>
                      {sub.expiresAt && sub.status === 'ACTIVE' && (
                        <small style={{ display: 'block', marginTop: '3px', color: 'var(--brand-primary)' }}>
                          Expires: {new Date(sub.expiresAt).toLocaleDateString()}
                        </small>
                      )}
                      {sub.rejectionReason && sub.status === 'REJECTED' && (
                        <small style={{ display: 'block', marginTop: '3px', color: '#b91c1c' }}>
                          {sub.rejectionReason}
                        </small>
                      )}
                    </div>
                    <div className="action-buttons">
                      {sub.status === 'PENDING' && (
                        <>
                          <button className="action-btn save-btn" onClick={() => handleVerify(sub.id)}>
                            ✓ Verify / Activate
                          </button>
                          <button className="action-btn delete-btn" onClick={() => setRejectingSub(sub)}>
                            ✕ Reject
                          </button>
                        </>
                      )}
                      {sub.status === 'REJECTED' && (
                        <button className="action-btn save-btn" onClick={() => handleVerify(sub.id)}>
                          Re-Activate
                        </button>
                      )}
                      {sub.status === 'ACTIVE' && (
                        <small style={{ color: '#059669' }}>Verified by {sub.verifiedBy}</small>
                      )}
                      {sub.status === 'EXPIRED' && (
                        <small style={{ color: 'var(--text-muted)' }}>Expired on {new Date(sub.expiresAt).toLocaleDateString()}</small>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </article>

        {/* Receipt Image Lightbox Modal */}
        {viewingReceipt && (
          <div className="photo-lightbox" onClick={() => setViewingReceipt(null)}>
            <div className="photo-lightbox-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', background: 'var(--bg-modal)', padding: '20px', borderRadius: '12px', border: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <b style={{ color: 'var(--brand-primary)', fontSize: '13px' }}>PAYMENT RECEIPT PROOF</b>
                <button className="lightbox-close" onClick={() => setViewingReceipt(null)} style={{ position: 'static' }}>✕</button>
              </div>
              <img src={viewingReceipt} alt="Receipt Full" style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: '8px' }} />
            </div>
          </div>
        )}

        {/* Rejection Modal */}
        {rejectingSub && (
          <div className="photo-lightbox" onClick={() => setRejectingSub(null)}>
            <div className="photo-lightbox-content" onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-modal)', padding: '28px', borderRadius: '12px', border: '1px solid #f8717155', maxWidth: '420px' }}>
              <h3 style={{ margin: '0 0 8px', font: '700 18px Syne', color: '#dc2626' }}>Reject Payment</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '0 0 16px' }}>
                Reject payment for: <b style={{ color: 'var(--text-main)' }}>{rejectingSub.name} ({rejectingSub.memberId})</b>
              </p>
              <textarea
                placeholder="Reason for rejection (e.g. Invalid UTR reference ID / Screenshot unreadable)"
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                style={{ width: '100%', height: '80px', padding: '10px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text-main)', marginBottom: '14px', resize: 'none' }}
              />
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="action-btn cancel-btn" onClick={() => setRejectingSub(null)}>Cancel</button>
                <button type="button" className="action-btn delete-btn" onClick={handleReject}>CONFIRM REJECTION</button>
              </div>
            </div>
          </div>
        )}
      </section>
    </LivePortal>
  )
}

// ----------------------------------------------------
// Student Membership (Student Portal - UPI Only)
// ----------------------------------------------------
function StudentMembership({ user, logout, onNavigate }) {
  const { platformMode } = usePlatformTheme()
  const isMrdu = platformMode === 'MRDU_EVENTS'
  const [subStatus, setSubStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [receiptPreview, setReceiptPreview] = useState('')
  const [copiedUpi, setCopiedUpi] = useState(false)

  function loadStatus() {
    setLoading(true)
    memberApi.getSubscriptionStatus()
      .then(res => setSubStatus(res))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadStatus()
  }, [])

  async function handleSubmitPayment(e) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const transactionRef = String(form.get('transactionRef') || '').trim()
    const amount = Number(form.get('amount') || subStatus?.monthlyAmount || 100)

    if (!transactionRef) {
      setError('Please enter your 12-digit UPI transaction / UTR reference number.')
      return
    }

    setSubmitting(true)
    setError('')
    setMessage('')
    try {
      await memberApi.submitSubscription({
        amount,
        transactionRef,
        paymentMethod: 'UPI',
        receiptImage: receiptPreview || null,
        paymentDate: new Date().toISOString(),
      })
      setMessage(isMrdu ? 'Your UPI student pass payment was submitted successfully. Verification in progress.' : 'Your UPI subscription payment was submitted successfully. An administrator will verify your membership shortly.')
      setReceiptPreview('')
      loadStatus()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  function copyUpiId() {
    if (!subStatus?.upiId) return
    navigator.clipboard?.writeText?.(subStatus.upiId)
    setCopiedUpi(true)
    setTimeout(() => setCopiedUpi(false), 2000)
  }

  const isEnabled = subStatus?.subscriptionEnabled
  const activeSub = subStatus?.activeSubscription
  const pendingSub = subStatus?.pendingSubscription
  const isExempt = subStatus?.isExempt

  return (
    <LivePortal user={user} logout={logout} activeTab="student-membership" onNavigate={onNavigate} title={isMrdu ? 'STUDENT PASS SUBSCRIPTION' : 'MEMBERSHIP SUBSCRIPTION'}>
      <section className="member-management">
        <div className="member-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate('student-dashboard')}>
              ← BACK TO DASHBOARD
            </button>
            <p className="eyebrow">{isMrdu ? 'MRDU ALL-ACCESS PASS' : 'COMMUNITY MEMBERSHIP'}</p>
            <h1>{isMrdu ? 'Student Event Pass Status' : 'Club Membership Status'}</h1>
            <p>{isMrdu ? 'Subscribe to unlock university event passes, technical symposium access, and workshop badges.' : 'Subscribe to unlock official event passes, hands-on lab access, and technical team support.'}</p>
          </div>
          <span className="president-lock">
            {isMrdu ? 'STUDENT ID' : 'MEMBER ID'}: {user.memberId}
          </span>
        </div>

        {message && <p className="member-form-success">{message}</p>}
        {error && <p className="member-form-error">{error}</p>}

        {loading ? (
          <p className="directory-state">Loading {isMrdu ? 'student pass' : 'membership'} information...</p>
        ) : isExempt ? (
          <div className="membership-status-box active-box">
            <h2 style={{ font: '700 22px Syne', color: '#70ddb4', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IconCrown size={20} /> Leadership Account Active
            </h2>
            <p style={{ color: '#9bb7cc', fontSize: '13px', margin: 0 }}>
              As an authorized leader ({getRoleLabel(user.role)}), you have full unlimited access to all features without a student subscription.
            </p>
          </div>
        ) : !isEnabled ? (
          <div className="membership-status-box active-box">
            <h2 style={{ font: '700 22px Syne', color: '#70ddb4', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icon8 name="authentication" size={20} /> Open {isMrdu ? 'Event Pass' : 'Membership'} Access
            </h2>
            <p style={{ color: '#9bb7cc', fontSize: '13px', margin: 0 }}>
              {isMrdu
                ? 'Student event pass access is currently open & free. You have full access to all university events and activities!'
                : 'Student membership subscription is currently open & free. You have full access to all club events and activities!'}
            </p>
          </div>
        ) : (
          <>
            {/* Status Card */}
            {activeSub ? (
              <div className="membership-status-box active-box">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <span className="badge badge-active" style={{ marginBottom: '8px' }}>{isMrdu ? 'ACTIVE STUDENT PASS' : 'ACTIVE MEMBERSHIP'}</span>
                    <h2 style={{ font: '700 24px Syne', color: 'var(--text-main)', margin: '4px 0' }}>{isMrdu ? 'You have an Active Student Pass' : 'You are an Active Member'}</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '4px 0' }}>
                      Your {isMrdu ? 'event pass' : 'membership'} is active and valid until <b style={{ color: 'var(--brand-primary)' }}>{new Date(activeSub.expiresAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })} at 23:59</b>.
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <small style={{ color: 'var(--text-dim)', font: '500 9px "DM Mono", monospace' }}>SUBSCRIPTION FEE</small>
                    <div style={{ font: '700 22px Syne', color: '#059669' }}>₹{Number(activeSub.amount).toFixed(2)}</div>
                  </div>
                </div>

                <div className="membership-benefits-list">
                  <div className="benefit-item"><i>•</i> Official Event Pass Registrations</div>
                  <div className="benefit-item"><i>•</i> Technical Team Support & Queries</div>
                  <div className="benefit-item"><i>•</i> Full Club Gallery Access</div>
                  <div className="benefit-item"><i>•</i> Hands-on CTF Defense Labs</div>
                </div>
              </div>
            ) : pendingSub ? (
              <div className="membership-status-box" style={{ borderColor: '#f59e0b55', background: 'radial-gradient(circle at 100% 0, rgba(245, 158, 11, 0.08), transparent 60%), var(--bg-card)' }}>
                <span className="badge badge-pending" style={{ marginBottom: '8px' }}>VERIFICATION PENDING</span>
                <h2 style={{ font: '700 22px Syne', color: '#d97706', margin: '4px 0 8px' }}>Payment Verification in Progress</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '0 0 14px' }}>
                  Your UPI subscription payment of <b style={{ color: 'var(--text-main)' }}>₹{Number(pendingSub.amount).toFixed(2)}</b> (Ref: {pendingSub.transactionRef}) was submitted on {new Date(pendingSub.submittedAt).toLocaleDateString()}. An administrator will verify and activate your membership shortly.
                </p>
              </div>
            ) : (
              <div className="membership-status-box inactive-box">
                <span className="badge badge-disabled" style={{ marginBottom: '8px' }}>MEMBERSHIP INACTIVE</span>
                <h2 style={{ font: '700 24px Syne', color: 'var(--text-main)', margin: '4px 0 8px' }}>Your membership is inactive.</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '0 0 16px' }}>
                  Subscribe via UPI to unlock official event passes, technical support, and member-only club activities.
                </p>
                <div className="membership-benefits-list">
                  <div className="benefit-item"><i>•</i> Event Pass Registrations (Subscription Required)</div>
                  <div className="benefit-item"><i>•</i> Technical Team Support (Subscription Required)</div>
                  <div className="benefit-item"><i>•</i> Member-Only Gallery (Subscription Required)</div>
                </div>
              </div>
            )}

            {/* UPI Payment Form & QR Display Grid */}
            <div className="member-management-grid" style={{ marginTop: '24px' }}>
              <article className="account-form-card">
                <p className="eyebrow">UPI PAYMENT GATEWAY</p>
                <h2>Submit UPI Membership Fee</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '4px 0 18px' }}>
                  Monthly Membership Fee: <b style={{ color: '#059669', fontSize: '16px' }}>₹{subStatus.monthlyAmount || 100}</b>
                </p>

                <form onSubmit={handleSubmitPayment}>
                  <div className="member-form-grid">
                    <label>
                      Monthly Fee (₹)
                      <input name="amount" type="number" readOnly value={subStatus.monthlyAmount || 100} style={{ opacity: 0.8 }} />
                    </label>
                    <label>
                      Payment Method
                      <input type="text" readOnly value="UPI (GPay / PhonePe / Paytm / BHIM)" style={{ opacity: 0.8, color: '#70ddb4' }} />
                    </label>
                    <label className="form-wide">
                      UPI / UTR Transaction Reference ID (12 Digits) *
                      <input name="transactionRef" required placeholder="e.g. 423984729103 or UPI Ref" />
                    </label>
                    <label className="form-wide">
                      Upload Payment Screenshot / Receipt (Optional)
                      <input
                        type="file"
                        accept="image/*"
                        onChange={e => {
                          const file = e.target.files?.[0]
                          if (file) readImageFile(file, setReceiptPreview)
                        }}
                      />
                    </label>
                  </div>

                  {receiptPreview && (
                    <div style={{ marginTop: '12px', textAlign: 'center' }}>
                      <img src={receiptPreview} alt="Receipt preview" style={{ maxHeight: '140px', borderRadius: '8px', border: '1px solid #52bbf544' }} />
                    </div>
                  )}

                  <button className="primary member-submit" disabled={submitting} style={{ marginTop: '18px', width: '100%' }}>
                    {submitting ? 'SUBMITTING…' : 'SUBMIT UPI PAYMENT FOR VERIFICATION'}
                  </button>
                </form>
              </article>

              {/* Official UPI Gateway Card */}
              <article className="account-form-card" style={{ textAlign: 'center' }}>
                <p className="eyebrow">OFFICIAL UPI GATEWAY</p>
                <h2>Scan & Pay with Any UPI App</h2>

                <div className="payment-qr-display" style={{ marginTop: '16px' }}>
                  {subStatus.qrUrl ? (
                    <img src={subStatus.qrUrl} alt="Club Official QR Code" />
                  ) : (
                    <div style={{ width: '180px', height: '180px', background: 'var(--panel-subtle)', border: '1px dashed var(--brand-border-subtle)', borderRadius: '8px', display: 'grid', placeContent: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>
                      UPI QR Code
                    </div>
                  )}
                  {subStatus.upiId && (
                    <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <code style={{ color: 'var(--brand-primary)', background: 'var(--bg-input)', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', border: '1px solid var(--line)' }}>
                        {subStatus.upiId}
                      </code>
                      <button type="button" className="action-btn edit-btn" onClick={copyUpiId}>
                        {copiedUpi ? '✓ Copied' : 'Copy UPI ID'}
                      </button>
                    </div>
                  )}
                </div>
                <small style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>
                  Pay via Google Pay, PhonePe, Paytm, or BHIM, then enter the transaction ID.
                </small>
              </article>
            </div>

            {/* Payment History Table */}
            <article className="member-list-card" style={{ marginTop: '24px' }}>
              <div className="card-heading">
                <div>
                  <p className="eyebrow">TRANSACTION HISTORY</p>
                  <h2>My Past Subscription Payments</h2>
                </div>
              </div>

              {(!subStatus.history || subStatus.history.length === 0) ? (
                <p className="directory-state">No subscription payment history recorded yet.</p>
              ) : (
                <div className="table-scroll-container">
                  <div className="sub-table">
                    <div className="sub-table-header" style={{ gridTemplateColumns: '1fr 1fr 1.4fr 1fr 1fr' }}>
                      <span>DATE</span>
                      <span>AMOUNT</span>
                      <span>TRANSACTION REF</span>
                      <span>STATUS</span>
                      <span>VALID UNTIL</span>
                    </div>
                    {subStatus.history.map(h => (
                      <div className="sub-table-row" key={h.id} style={{ gridTemplateColumns: '1fr 1fr 1.4fr 1fr 1fr' }}>
                        <div>
                          <b>{new Date(h.submittedAt).toLocaleDateString()}</b>
                        </div>
                        <div>
                          <strong style={{ color: '#70ddb4' }}>₹{Number(h.amount).toFixed(2)}</strong>
                        </div>
                        <div>
                          <small style={{ color: '#85d7ff' }}>{h.transactionRef}</small>
                        </div>
                        <div>
                          <span className={`badge badge-${h.status.toLowerCase()}`}>
                            {h.status}
                          </span>
                        </div>
                        <div>
                          <small style={{ color: '#85d7ff' }}>
                            {h.expiresAt ? new Date(h.expiresAt).toLocaleDateString() : '—'}
                          </small>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </article>
          </>
        )}
      </section>
    </LivePortal>
  )
}

// ----------------------------------------------------
// Event Management & Studio
// ----------------------------------------------------
// ----------------------------------------------------
// Event Management & Studio
// ----------------------------------------------------
const initialEventForm = {
  title: '',
  eventType: 'Workshop',
  status: 'UPCOMING',
  dateTime: '',
  venue: '',
  location: '',
  shortDescription: '',
  description: '',
  registrationFormUrl: '',
  completionFormUrl: '',
  notes: '', // Serialized JSON or fallback link
  agenda: '',
  rules: '',
  capacity: '',
  coordinatorName: '',
  coordinatorContact: '',
  organizingTeam: '',
  isTeamEvent: false,
  minTeamSize: 2,
  maxTeamSize: 4,
  teamRules: '',
  isPaid: false,
  paymentAmount: '',
  paymentUpiId: '',
  paymentInstructions: '',
  hasMultipleActivities: false,
}

function EventManagement({ user, logout, onNavigate }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('basic')
  // View Mode: 'CATALOG' (Published Events Catalog) vs 'BUILDER' (Create / Edit Studio)
  const [eventView, setEventView] = useState('CATALOG')

  const [formData, setFormData] = useState(initialEventForm)
  const [activities, setActivities] = useState([])
  const [formFields, setFormFields] = useState([])
  const [posterPreview, setPosterPreview] = useState('')
  const [qrPreview, setQrPreview] = useState('')

  const [editingEventId, setEditingEventId] = useState(null)
  const [analyticsModalEvent, setAnalyticsModalEvent] = useState(null)
  const [analyticsData, setAnalyticsData] = useState(null)
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)
  const [rosterSearch, setRosterSearch] = useState('')
  const [selectedRosterPass, setSelectedRosterPass] = useState(null)

  useEffect(() => {
    let mounted = true
    adminApi.listEvents()
      .then(({ events: list }) => { if (mounted) setEvents(list || []) })
      .catch(err => { if (mounted) setError(err.message) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  function updateFormField(field, value) {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  function addActivity() {
    setActivities(c => [...c, { name: '', description: '', price: 0, capacity: '' }])
  }
  function updateActivity(index, field, value) {
    setActivities(c => c.map((act, i) => (i === index ? { ...act, [field]: value } : act)))
  }
  function removeActivity(index) {
    setActivities(c => c.filter((_, i) => i !== index))
  }

  function addCustomField() {
    setFormFields(c => [...c, { fieldName: '', fieldType: 'text', isRequired: false, options: '' }])
  }
  function updateCustomField(index, field, value) {
    setFormFields(c => c.map((ff, i) => (i === index ? { ...ff, [field]: value } : ff)))
  }
  function removeCustomField(index) {
    setFormFields(c => c.filter((_, i) => i !== index))
  }

  function startEditEvent(ev) {
    const formUrls = getEventFormUrls(ev)
    setEditingEventId(ev.id)
    setFormData({
      title: ev.title || '',
      eventType: ev.eventType || 'Workshop',
      status: ev.status || 'UPCOMING',
      dateTime: ev.dateTime ? new Date(ev.dateTime).toISOString().slice(0, 16) : '',
      venue: ev.venue || '',
      location: ev.location || '',
      shortDescription: ev.shortDescription || '',
      description: ev.description || '',
      registrationFormUrl: formUrls.registrationFormUrl || '',
      completionFormUrl: formUrls.completionFormUrl || '',
      notes: ev.notes || '',
      agenda: ev.agenda || '',
      rules: ev.rules || '',
      capacity: ev.capacity != null ? String(ev.capacity) : '',
      coordinatorName: ev.coordinatorName || '',
      coordinatorContact: ev.coordinatorContact || '',
      organizingTeam: ev.organizingTeam || '',
      isTeamEvent: Boolean(ev.isTeamEvent),
      minTeamSize: ev.minTeamSize || 2,
      maxTeamSize: ev.maxTeamSize || 4,
      teamRules: ev.teamRules || '',
      isPaid: Boolean(ev.requiresPayment || (ev.paymentAmount && ev.paymentAmount > 0)),
      paymentAmount: ev.paymentAmount != null ? String(ev.paymentAmount) : '',
      paymentUpiId: ev.paymentUpiId || '',
      paymentInstructions: ev.paymentInstructions || '',
      hasMultipleActivities: Boolean(ev.allowMultipleActivities),
    })
    setPosterPreview(ev.photoUrl || '')
    setQrPreview(ev.paymentQrUrl || '')
    setActivities(ev.activities ? ev.activities.map(a => ({ name: a.name || '', description: a.description || '', price: a.price || 0, capacity: a.capacity != null ? String(a.capacity) : '' })) : [])
    setFormFields(ev.formFields || [])
    setActiveTab('basic')
    setMessage('')
    setError('')
    setEventView('BUILDER')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditingEventId(null)
    setFormData(initialEventForm)
    setPosterPreview('')
    setQrPreview('')
    setActivities([])
    setFormFields([])
    setActiveTab('basic')
    setMessage('')
    setError('')
    setEventView('CATALOG')
  }

  async function handleEventSubmit(e) {
    e.preventDefault()
    setMessage('')
    setError('')

    const title = String(formData.title || '').trim()
    const eventType = String(formData.eventType || '').trim()
    const dateTime = String(formData.dateTime || '').trim()

    if (!title) {
      setActiveTab('basic')
      setError('Event Title is required (under Basic Info).')
      return
    }
    if (!eventType) {
      setActiveTab('basic')
      setError('Event Category / Type is required (under Basic Info).')
      return
    }
    if (!dateTime) {
      setActiveTab('basic')
      setError('Event Date & Time is required (under Basic Info).')
      return
    }

    if (formData.isPaid && !formData.paymentAmount && !activities.length) {
      setActiveTab('pricing')
      setError('Please specify the registration fee for this paid event.')
      return
    }

    const payload = {
      title,
      eventType,
      dateTime,
      shortDescription: String(formData.shortDescription || '').trim() || null,
      description: String(formData.description || '').trim() || null,
      venue: String(formData.venue || '').trim() || null,
      location: String(formData.location || '').trim() || null,
      capacity: formData.capacity ? Number(formData.capacity) : null,
      photoUrl: posterPreview || null,
      status: String(formData.status || 'UPCOMING'),
      coordinatorName: String(formData.coordinatorName || user.name).trim() || null,
      coordinatorContact: String(formData.coordinatorContact || user.memberId).trim() || null,
      organizingTeam: String(formData.organizingTeam || '').trim() || null,
      rules: String(formData.rules || '').trim() || null,
      agenda: String(formData.agenda || '').trim() || null,
      isTeamEvent: Boolean(formData.isTeamEvent),
      minTeamSize: formData.isTeamEvent ? Number(formData.minTeamSize || 2) : 1,
      maxTeamSize: formData.isTeamEvent ? Number(formData.maxTeamSize || 4) : 1,
      teamRules: formData.isTeamEvent ? String(formData.teamRules || '').trim() || null : null,
      requiresPayment: Boolean(formData.isPaid),
      paymentAmount: formData.isPaid && formData.paymentAmount ? Number(formData.paymentAmount) : null,
      paymentQrUrl: formData.isPaid ? qrPreview || null : null,
      paymentUpiId: formData.isPaid ? String(formData.paymentUpiId || '').trim() || null : null,
      paymentInstructions: formData.isPaid ? String(formData.paymentInstructions || '').trim() || null : null,
      allowMultipleActivities: Boolean(formData.hasMultipleActivities),
      activities: formData.hasMultipleActivities
        ? activities.map(a => ({ name: a.name, description: a.description || null, price: Number(a.price || 0), capacity: a.capacity ? Number(a.capacity) : null }))
        : [],
      notes: (formData.registrationFormUrl || formData.completionFormUrl)
        ? JSON.stringify({
            registrationFormUrl: String(formData.registrationFormUrl || '').trim() || null,
            completionFormUrl: String(formData.completionFormUrl || '').trim() || null,
          })
        : (String(formData.notes || '').trim() || null),
      formFields,
    }

    setSubmitting(true)
    try {
      if (editingEventId) {
        const { event: updated } = await adminApi.updateEvent(editingEventId, payload)
        setEvents(c => c.map(ev => (ev.id === editingEventId ? updated : ev)))
        setMessage(`Event "${updated.title}" updated successfully.`)
        cancelEdit()
      } else {
        const { event: created } = await adminApi.createEvent(payload)
        setEvents(c => [created, ...c])
        setMessage(`Event "${created.title}" published! Created by ${user.name} (${user.memberId}).`)
        setFormData(initialEventForm)
        setPosterPreview('')
        setQrPreview('')
        setActivities([])
        setFormFields([])
        setActiveTab('basic')
        setEventView('CATALOG')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function removeEvent(id) {
    if (!confirm('Are you sure you want to delete this event and all its registrations?')) return
    try {
      await adminApi.deleteEvent(id)
      setEvents(c => c.filter(e => e.id !== id))
      if (editingEventId === id) cancelEdit()
      setMessage('Event deleted.')
    } catch (err) {
      setError(err.message)
    }
  }

  async function openAnalytics(event) {
    setAnalyticsModalEvent(event)
    setRosterSearch('')
    setSelectedRosterPass(null)
    setLoadingAnalytics(true)
    try {
      const data = await adminApi.getEventDetailsWithStats(event.id)
      setAnalyticsData(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingAnalytics(false)
    }
  }

  async function handleVerifyRosterUTR(regId) {
    try {
      await adminApi.verifyPassPayment(regId)
      setAnalyticsData(prev => {
        if (!prev) return prev
        return {
          ...prev,
          registrations: (prev.registrations || []).map(r => (r.id === regId ? { ...r, paymentStatus: 'VERIFIED', status: 'REGISTERED' } : r)),
        }
      })
      if (selectedRosterPass && selectedRosterPass.id === regId) {
        setSelectedRosterPass(p => ({ ...p, paymentStatus: 'VERIFIED', status: 'REGISTERED' }))
      }
      setMessage('Payment verified successfully! Digital pass activated.')
    } catch (err) {
      setError(err.message || 'Failed to verify payment.')
    }
  }

  async function handleCheckInRoster(regId) {
    try {
      await adminApi.grantEventEntry(regId)
      const nowIso = new Date().toISOString()
      setAnalyticsData(prev => {
        if (!prev) return prev
        return {
          ...prev,
          registrations: (prev.registrations || []).map(r => (r.id === regId ? { ...r, attendanceMarked: true, attendedAt: nowIso } : r)),
        }
      })
      if (selectedRosterPass && selectedRosterPass.id === regId) {
        setSelectedRosterPass(p => ({ ...p, attendanceMarked: true, attendedAt: nowIso }))
      }
      setMessage('Attendee admitted and gate attendance recorded!')
    } catch (err) {
      setError(err.message || 'Failed to mark gate entry.')
    }
  }

  function handleDownloadEventsList() {
    const headers = [
      'Event ID',
      'Event Title',
      'Category',
      'Mode',
      'Min Team',
      'Max Team',
      'Status',
      'Date & Time',
      'Venue / Lab',
      'Capacity',
      'Registered Count',
      'Coordinator Name',
      'Price (₹)',
      'Short Description',
    ]
    const rows = events.map(ev => [
      ev.id,
      ev.title,
      ev.eventType,
      ev.isTeamEvent ? 'Team' : 'Individual',
      ev.minTeamSize || 1,
      ev.maxTeamSize || 1,
      ev.status,
      ev.dateTime ? new Date(ev.dateTime).toLocaleString() : null,
      ev.venue || ev.location,
      ev.capacity,
      ev.registrationCount ?? ev._count?.registrations ?? 0,
      ev.coordinatorName,
      ev.paymentAmount || ev.price || 0,
      ev.shortDescription,
    ])
    downloadCsv('club_events_catalog.csv', headers, rows)
  }

  function handleDownloadEventRegistrations(ev, regs) {
    const headers = [
      'Registration ID',
      'Event Title',
      'Member ID',
      'Full Name',
      'College / Institution',
      'Department / Branch',
      'Academic Year',
      'College Roll Number',
      'Gender',
      'Age',
      'Official Email',
      'Phone Number',
      'Emergency Contact',
      'Residency Type',
      'Commute / Hostel Mode',
      'Participation Mode',
      'Team Name',
      'Is Team Leader',
      'Registration Fee (₹)',
      'Payment Status',
      'Payment UTR Reference',
      'Gate Attendance',
      'Check-in Timestamp',
      'Registration Date',
    ]
    const rows = (regs || []).map(r => [
      r.id,
      ev?.title,
      r.memberId || r.user?.memberId,
      r.name || r.memberName || r.user?.profile?.name || r.user?.name,
      r.department || r.user?.profile?.department,
      r.branch || r.department || r.user?.profile?.department,
      r.year || r.user?.profile?.year,
      r.rollNumber || r.user?.profile?.rollNumber || r.formData?.rollNumber,
      r.gender || r.user?.profile?.gender || 'UNSPECIFIED',
      r.age || r.user?.profile?.age || null,
      r.email || r.user?.profile?.email,
      r.phone || r.user?.profile?.phone,
      r.emergencyContact,
      r.residencyType || 'DAY_SCHOLAR',
      r.residencyType === 'HOSTELLER' ? (r.hostelType || 'COLLEGE_HOSTEL') : (r.transportMode || 'OWN_TRANSPORT'),
      r.teamName ? 'Team' : 'Individual',
      r.teamName || 'N/A',
      r.isTeamLeader ? 'Yes' : 'No',
      Number(r.totalAmount) || 0,
      r.paymentStatus,
      r.paymentReference || 'N/A',
      r.attendanceMarked ? 'Admitted / Present' : 'Not Admitted',
      r.attendedAt ? new Date(r.attendedAt).toLocaleString() : 'N/A',
      r.registeredAt ? new Date(r.registeredAt).toLocaleString() : null,
    ])
    downloadCsv(`event_${ev.id}_registrations.csv`, headers, rows)
  }

  return (
    <LivePortal user={user} logout={logout} activeTab="admin-events" onNavigate={onNavigate} title="EVENT STUDIO & ANALYTICS">
      <section className="event-management">
        <div className="event-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate('admin-dashboard')}>
              ← COMMAND CENTER
            </button>
            <p className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <IconSparkles size={13} /> COMPREHENSIVE WORKFLOW STUDIO
            </p>
            <h1>Club Events & Master Studio</h1>
            <p>Publish workshops, CTF competitions, seminars, and team hackathons with clean pricing & pass tracking.</p>
          </div>
          <div className="event-heading-actions">
            <button
              type="button"
              className="outline"
              onClick={() => onNavigate('admin-passes')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '7px 14px' }}
              title="View all registered student passes and UTR records"
            >
              <IconCreditCard size={14} /> Passes & Roster →
            </button>
            <button
              type="button"
              className="outline"
              onClick={() => onNavigate('admin-qr-scanner')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '7px 14px' }}
              title="Scan attendee event passes and verify tickets"
            >
              <Icon8 name="irisScan" size={14} /> Gate Scanner →
            </button>
            <button
              type="button"
              className="outline"
              onClick={handleDownloadEventsList}
              disabled={events.length === 0}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '7px 14px' }}
              title="Download events catalog as CSV"
            >
              <IconDownload size={13} /> Export CSV
            </button>
          </div>
        </div>

        {message && <p className="member-form-success">{message}</p>}
        {error && <p className="member-form-error">{error}</p>}

        <div className="event-view-switcher">
          <button
            type="button"
            className={eventView === 'CATALOG' ? 'primary active' : 'outline'}
            onClick={() => setEventView('CATALOG')}
          >
            <IconSparkles size={14} /> Published Events ({events.length})
          </button>
          <button
            type="button"
            className={eventView === 'BUILDER' ? 'primary active' : 'outline'}
            onClick={() => {
              if (!editingEventId) setFormData(initialEventForm)
              setEventView('BUILDER')
            }}
          >
            <Icon8 name="customForms" size={14} /> {editingEventId ? 'Editing Event' : '＋ Create & Publish Event'}
          </button>
        </div>

        {eventView === 'BUILDER' ? (
          /* Full-Width Event Builder Studio Card */
          <article className="account-form-card" style={{ maxWidth: '960px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <p className="eyebrow">{editingEventId ? 'EDITING EVENT' : 'EVENT BUILDER STUDIO'}</p>
                <h2>{editingEventId ? 'Update Event Details' : 'Create & Publish New Event'}</h2>
              </div>
              <button
                type="button"
                className="outline"
                onClick={cancelEdit}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}
              >
                ← BACK TO EVENTS CATALOG
              </button>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '0 0 16px' }}>
              Coordinator: <b style={{ color: 'var(--brand-primary)' }}>{user.name} ({user.memberId})</b>
            </p>

            <div className="audit-tabs" style={{ marginBottom: '20px' }}>
              <button type="button" className={`audit-tab-btn ${activeTab === 'basic' ? 'active' : ''}`} onClick={() => setActiveTab('basic')}>1. Basic & Schedule</button>
              <button type="button" className={`audit-tab-btn ${activeTab === 'teams' ? 'active' : ''}`} onClick={() => setActiveTab('teams')}>2. Participation & Teams</button>
              <button type="button" className={`audit-tab-btn ${activeTab === 'pricing' ? 'active' : ''}`} onClick={() => setActiveTab('pricing')}>3. Pricing & UPI</button>
              <button type="button" className={`audit-tab-btn ${activeTab === 'fields' ? 'active' : ''}`} onClick={() => setActiveTab('fields')}>4. Custom Fields</button>
            </div>

            <form onSubmit={handleEventSubmit}>
              {/* Tab 1: Basic Info & Schedule */}
              {activeTab === 'basic' && (
                <div className="member-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                  <label className="form-wide" style={{ gridColumn: '1 / -1' }}>
                    Event Title *
                    <input
                      name="title"
                      required
                      placeholder="e.g. Offensive Cyber Operations Workshop 2026"
                      value={formData.title}
                      onChange={e => updateFormField('title', e.target.value)}
                    />
                  </label>
                  <label>
                    Category / Type *
                    <select
                      className="member-select"
                      name="eventType"
                      value={formData.eventType}
                      onChange={e => updateFormField('eventType', e.target.value)}
                    >
                      <option value="Workshop">Hands-on Workshop</option>
                      <option value="CTF">CTF Competition</option>
                      <option value="Seminar">Guest Seminar</option>
                      <option value="Bootcamp">Security Bootcamp</option>
                      <option value="Hackathon">Cyber Hackathon</option>
                      <option value="Summit">Security Summit</option>
                      <option value="Cultural">Cultural / Campus Event</option>
                    </select>
                  </label>
                  <label>
                    Status
                    <select
                      className="member-select"
                      name="status"
                      value={formData.status}
                      onChange={e => updateFormField('status', e.target.value)}
                    >
                      <option value="UPCOMING">Upcoming</option>
                      <option value="LIVE">Live Now</option>
                      <option value="COMPLETED">Completed</option>
                    </select>
                  </label>
                  <label>
                    Date & Time *
                    <input
                      type="datetime-local"
                      name="dateTime"
                      required
                      value={formData.dateTime}
                      onChange={e => updateFormField('dateTime', e.target.value)}
                    />
                  </label>
                  <label>
                    Venue / Campus Location
                    <input
                      name="venue"
                      placeholder="e.g. Cyber Defense Lab 304 / Main Auditorium"
                      value={formData.venue}
                      onChange={e => updateFormField('venue', e.target.value)}
                    />
                  </label>
                  <label>
                    Max Seat Capacity (Optional)
                    <input
                      type="number"
                      name="capacity"
                      min="1"
                      placeholder="Leave blank for unlimited"
                      value={formData.capacity}
                      onChange={e => updateFormField('capacity', e.target.value)}
                    />
                  </label>
                  <label className="form-wide" style={{ gridColumn: '1 / -1' }}>
                    Short Synopsis (Catalog Banner)
                    <input
                      name="shortDescription"
                      placeholder="One-line summary shown on event catalog and cards"
                      value={formData.shortDescription}
                      onChange={e => updateFormField('shortDescription', e.target.value)}
                    />
                  </label>
                  <label className="form-wide" style={{ gridColumn: '1 / -1' }}>
                    Event Poster / Banner Image (Optional)
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => { const f = e.target.files?.[0]; if (f) readImageFile(f, setPosterPreview) }}
                    />
                  </label>
                  {posterPreview && (
                    <div style={{ gridColumn: '1 / -1', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <img src={posterPreview} alt="Event Poster Preview" style={{ width: '120px', height: '68px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--brand-border-subtle)' }} />
                      <button type="button" className="action-btn cancel-btn" onClick={() => setPosterPreview('')}>Remove Poster</button>
                    </div>
                  )}
                  <label className="form-wide" style={{ gridColumn: '1 / -1' }}>
                    Detailed Event Description & Overview
                    <textarea
                      rows={4}
                      name="description"
                      placeholder="Comprehensive details, what students will learn, takeaways, and prerequisites."
                      value={formData.description}
                      onChange={e => updateFormField('description', e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)', fontSize: '12px' }}
                    />
                  </label>
                  <div className="form-wide" style={{ gridColumn: '1 / -1', background: 'var(--panel-subtle)', border: '1px solid var(--line)', borderRadius: '10px', padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <span style={{ fontSize: '18px' }}>📋</span>
                      <div>
                        <b style={{ color: 'var(--text-main)', fontSize: '13px', display: 'block' }}>Event Two-Form Workflow (Pre-Registration & Post-Completion)</b>
                        <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Attach official Google Forms or external links for attendee pre-registration and post-event hackathon project submissions.</small>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="badge" style={{ background: 'rgba(82, 187, 245, 0.15)', color: 'var(--brand-primary)', fontSize: '10px' }}>FORM 1</span>
                          Pre-Registration Form Link (Google Form / External)
                        </span>
                        <input
                          name="registrationFormUrl"
                          placeholder="https://forms.gle/... (Required before payment & pass generation)"
                          value={formData.registrationFormUrl || ''}
                          onChange={e => updateFormField('registrationFormUrl', e.target.value)}
                          style={{ width: '100%', marginTop: '4px' }}
                        />
                        <small style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 400 }}>
                          Students must open & submit this form first during Step 1 of registration.
                        </small>
                      </label>

                      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontSize: '10px' }}>FORM 2</span>
                          Post-Completion / Hackathon Submission Form Link
                        </span>
                        <input
                          name="completionFormUrl"
                          placeholder="https://forms.gle/... (Post-hackathon project submission / feedback)"
                          value={formData.completionFormUrl || ''}
                          onChange={e => updateFormField('completionFormUrl', e.target.value)}
                          style={{ width: '100%', marginTop: '4px' }}
                        />
                        <small style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 400 }}>
                          Attendees fill this after completing the hackathon to submit project repo, demo & verify participation.
                        </small>
                      </label>
                    </div>
                  </div>
                  <div className="form-wide" style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                    <button type="button" className="action-btn save-btn" onClick={() => setActiveTab('teams')}>Next: Participation & Teams →</button>
                  </div>
                </div>
              )}

              {/* Tab 2: Participation & Teams */}
              {activeTab === 'teams' && (
                <div className="member-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                  <label>
                    Participation Type
                    <select
                      className="member-select"
                      value={formData.isTeamEvent ? 'TEAM' : 'INDIVIDUAL'}
                      onChange={e => updateFormField('isTeamEvent', e.target.value === 'TEAM')}
                    >
                      <option value="INDIVIDUAL">Individual Participation</option>
                      <option value="TEAM">Team / Group Participation</option>
                    </select>
                  </label>

                  {formData.isTeamEvent && (
                    <>
                      <label>
                        Min Team Members
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={formData.minTeamSize}
                          onChange={e => updateFormField('minTeamSize', e.target.value)}
                        />
                      </label>
                      <label>
                        Max Team Members
                        <input
                          type="number"
                          min="1"
                          max="30"
                          value={formData.maxTeamSize}
                          onChange={e => updateFormField('maxTeamSize', e.target.value)}
                        />
                      </label>
                      <label className="form-wide" style={{ gridColumn: '1 / -1' }}>
                        Team Formation Rules / Guidelines
                        <textarea
                          rows={3}
                          placeholder="e.g. Cross-department teams are allowed. Team leader must submit registration for all members."
                          value={formData.teamRules}
                          onChange={e => updateFormField('teamRules', e.target.value)}
                          style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)', fontSize: '12px' }}
                        />
                      </label>
                    </>
                  )}

                  <label className="form-wide" style={{ gridColumn: '1 / -1' }}>
                    Event Agenda / Schedule Breakdown
                    <textarea
                      rows={3}
                      placeholder="e.g. 10:00 AM - Opening Keynote | 11:30 AM - Live Sandbox | 02:00 PM - Final Showdown"
                      value={formData.agenda}
                      onChange={e => updateFormField('agenda', e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)', fontSize: '12px' }}
                    />
                  </label>
                  <label className="form-wide" style={{ gridColumn: '1 / -1' }}>
                    Competition Rules / Eligibility Criteria
                    <textarea
                      rows={3}
                      placeholder="e.g. Open to all MRDU engineering and management students. Laptops required."
                      value={formData.rules}
                      onChange={e => updateFormField('rules', e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)', fontSize: '12px' }}
                    />
                  </label>
                  <div className="form-wide" style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                    <button type="button" className="action-btn cancel-btn" onClick={() => setActiveTab('basic')}>← Back</button>
                    <button type="button" className="action-btn save-btn" onClick={() => setActiveTab('pricing')}>Next: Pricing & UPI →</button>
                  </div>
                </div>
              )}

              {/* Tab 3: Pricing & UPI Gateway */}
              {activeTab === 'pricing' && (
                <div>
                  <div className="event-builder-box">
                    <div className="event-builder-box-title">
                      <IconCreditCard size={14} /> EVENT PRICING & PAYMENT GATEWAY
                    </div>
                    <div className="event-mode-grid">
                      <div
                        className={`event-mode-card ${!formData.isPaid ? 'selected selected-free' : ''}`}
                        onClick={() => updateFormField('isPaid', false)}
                      >
                        <div className="event-mode-card-header">
                          <span className="event-mode-card-icon">
                            <IconSparkles size={16} />
                          </span>
                          <div className="event-mode-radio">
                            {!formData.isPaid && <div className="event-mode-radio-dot" />}
                          </div>
                        </div>
                        <h4 className="event-mode-title">Free Event (₹0)</h4>
                        <p className="event-mode-desc">Open registration. Passes are issued immediately upon sign-up with instant QR generation.</p>
                      </div>

                      <div
                        className={`event-mode-card ${formData.isPaid ? 'selected' : ''}`}
                        onClick={() => updateFormField('isPaid', true)}
                      >
                        <div className="event-mode-card-header">
                          <span className="event-mode-card-icon">
                            <IconQrCode size={16} />
                          </span>
                          <div className="event-mode-radio">
                            {formData.isPaid && <div className="event-mode-radio-dot" />}
                          </div>
                        </div>
                        <h4 className="event-mode-title">Paid Event (UPI / Cash)</h4>
                        <p className="event-mode-desc">Requires students to submit a 12-digit UPI UTR transaction ID for admin verification before entry.</p>
                      </div>
                    </div>

                    {formData.isPaid && (
                      <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--line)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                          <label>
                            Registration Fee (₹) *
                            <input
                              type="number"
                              min="1"
                              placeholder="e.g. 150"
                              value={formData.paymentAmount}
                              onChange={e => updateFormField('paymentAmount', e.target.value)}
                            />
                          </label>
                          <label>
                            Club UPI ID for Payments
                            <input
                              placeholder="e.g. mrduclub@okaxis"
                              value={formData.paymentUpiId}
                              onChange={e => updateFormField('paymentUpiId', e.target.value)}
                            />
                          </label>
                        </div>
                        <label className="form-wide">
                          Payment Instructions
                          <input
                            placeholder="e.g. Scan QR using PhonePe/GPay, pay the fee, and enter your 12-digit UTR number below."
                            value={formData.paymentInstructions}
                            onChange={e => updateFormField('paymentInstructions', e.target.value)}
                          />
                        </label>

                        {/* Payment QR Code Uploader */}
                        <div className="form-wide" style={{ marginTop: '14px', padding: '16px', background: 'var(--panel-subtle)', borderRadius: '10px', border: '1px solid var(--line)' }}>
                          <b style={{ color: 'var(--text-main)', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <IconQrCode size={15} /> Payment UPI QR Code Image *
                          </b>
                          <p style={{ color: 'var(--text-muted)', fontSize: '11px', margin: '0 0 12px', lineHeight: 1.4 }}>
                            Upload your official UPI QR image (PhonePe, Google Pay, Paytm, BHIM). Students scan this QR to pay the fee.
                          </p>

                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-start' }}>
                            <div style={{ flex: 1, minWidth: '220px' }}>
                              <input
                                type="file"
                                accept="image/*"
                                id="payment-qr-file-input"
                                onChange={e => {
                                  const f = e.target.files?.[0]
                                  if (f) readImageFile(f, setQrPreview)
                                }}
                                style={{ width: '100%' }}
                              />
                              <small style={{ color: 'var(--text-muted)', fontSize: '10.5px', display: 'block', marginTop: '4px' }}>
                                Supports PNG, JPG, JPEG, WEBP.
                              </small>

                              {/* Auto-Generate Button from UPI ID */}
                              {formData.paymentUpiId && (
                                <button
                                  type="button"
                                  className="outline"
                                  onClick={() => {
                                    const upiUrl = `upi://pay?pa=${encodeURIComponent(formData.paymentUpiId)}&pn=${encodeURIComponent('CyberSecurityClub')}${formData.paymentAmount ? `&am=${encodeURIComponent(formData.paymentAmount)}` : ''}&cu=INR`
                                    const autoQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiUrl)}`
                                    setQrPreview(autoQrUrl)
                                    setMessage('✓ Auto-generated UPI QR Code from your UPI ID!')
                                  }}
                                  style={{ marginTop: '10px', fontSize: '11px', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px', borderColor: 'var(--brand-primary)', color: 'var(--brand-primary)' }}
                                >
                                  ⚡ Auto-Generate UPI QR from Club UPI ID
                                </button>
                              )}
                            </div>

                            {/* QR Image Preview */}
                            {qrPreview ? (
                              <div style={{ textAlign: 'center', padding: '10px', background: '#fff', borderRadius: '8px', border: '2px solid var(--brand-primary)', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                                <img
                                  src={qrPreview}
                                  alt="Payment QR Preview"
                                  style={{ width: '130px', height: '130px', objectFit: 'contain', display: 'block', margin: '0 auto' }}
                                />
                                <span style={{ color: '#059669', fontSize: '10.5px', fontWeight: 700, display: 'block', marginTop: '6px' }}>
                                  ✓ QR CODE ATTACHED
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setQrPreview('')}
                                  style={{ marginTop: '4px', fontSize: '10px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                                >
                                  Remove QR
                                </button>
                              </div>
                            ) : (
                              <div style={{ padding: '18px 24px', textAlign: 'center', background: 'var(--bg-input)', border: '1px dashed var(--line)', borderRadius: '8px', minWidth: '140px' }}>
                                <span style={{ fontSize: '24px', opacity: 0.5, display: 'block' }}>📷</span>
                                <small style={{ display: 'block', color: 'var(--text-dim)', fontSize: '10.5px', marginTop: '4px' }}>
                                  No QR Image Uploaded
                                </small>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="form-wide" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                    <button type="button" className="action-btn cancel-btn" onClick={() => setActiveTab('teams')}>← Back</button>
                    <button type="button" className="action-btn save-btn" onClick={() => setActiveTab('fields')}>Next: Custom Questions →</button>
                  </div>
                </div>
              )}

              {/* Tab 4: Custom Questions */}
              {activeTab === 'fields' && (
                <div>
                  <div className="event-builder-box">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                      <div className="event-builder-box-title" style={{ margin: 0 }}>
                        <Icon8 name="customForms" size={14} /> CUSTOM REGISTRATION QUESTIONS
                      </div>
                      <button type="button" className="action-btn save-btn" onClick={addCustomField} style={{ fontSize: '11px', padding: '6px 12px' }}>
                        ＋ Add Question
                      </button>
                    </div>
                    {formFields.length === 0 ? (
                      <div style={{ padding: '24px 16px', textAlign: 'center', background: 'var(--bg-input)', borderRadius: '8px', border: '1px dashed var(--line)' }}>
                        <p style={{ color: 'var(--text-main)', fontSize: '13px', fontWeight: 600, margin: '0 0 4px' }}>Standard Student Profile Form Only</p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '11.5px', margin: 0 }}>Default fields (Full Name, Member ID, Roll Number, Gender, Age, Department & College) are captured automatically. Click "Add Question" to ask custom event-specific queries.</p>
                      </div>
                    ) : (
                      formFields.map((ff, i) => (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr auto auto', gap: '10px', marginBottom: '10px', alignItems: 'center', padding: '10px', background: 'var(--bg-input)', borderRadius: '8px', border: '1px solid var(--line)' }}>
                          <input placeholder="Question prompt (e.g. GitHub URL / Dietary Preference)" value={ff.fieldName} onChange={e => updateCustomField(i, 'fieldName', e.target.value)} />
                          <select value={ff.fieldType} onChange={e => updateCustomField(i, 'fieldType', e.target.value)}>
                            <option value="text">Short Text</option>
                            <option value="textarea">Long Text</option>
                            <option value="select">Dropdown Choice</option>
                          </select>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={ff.isRequired} onChange={e => updateCustomField(i, 'isRequired', e.target.checked)} /> Required
                          </label>
                          <button type="button" className="action-btn delete-btn" onClick={() => removeCustomField(i)}>✕</button>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="form-wide" style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '10px' }}>
                    <button type="button" className="action-btn cancel-btn" onClick={() => setActiveTab('pricing')}>
                      ← Back to Pricing & UPI
                    </button>
                  </div>
                </div>
              )}

              <div className="event-actions" style={{ marginTop: '22px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button type="submit" className="primary member-submit" disabled={submitting} style={{ padding: '12px 24px', fontWeight: 700 }}>
                  {submitting ? 'SAVING EVENT…' : editingEventId ? '✓ UPDATE EVENT' : '＋ PUBLISH EVENT'}
                </button>
                <button type="button" className="action-btn cancel-btn" onClick={cancelEdit}>
                  Cancel
                </button>
              </div>
            </form>
          </article>
        ) : (
          /* Full-Width Published Events Catalog Card */
          <article className="member-list-card" style={{ width: '100%' }}>
            <div className="card-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
              <div>
                <p className="eyebrow">EVENT CATALOG & PASSES</p>
                <h2>Published Events & Sessions ({events.length})</h2>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="primary"
                  onClick={() => {
                    if (!editingEventId) setFormData(initialEventForm)
                    setEventView('BUILDER')
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '6px 14px' }}
                >
                  <Icon8 name="customForms" size={14} /> ＋ CREATE NEW EVENT
                </button>
                <button
                  type="button"
                  className="outline"
                  onClick={handleDownloadEventsList}
                  disabled={events.length === 0}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '6px 12px' }}
                  title="Download events catalog as CSV"
                >
                  <IconDownload size={14} /> DOWNLOAD EVENTS CSV
                </button>
              </div>
            </div>

            {loading ? (
              <p className="directory-state" style={{ marginTop: '24px' }}>Loading events...</p>
            ) : events.length === 0 ? (
              <p className="directory-state" style={{ marginTop: '24px' }}>No events published yet. Click "Create New Event" above to publish your first session.</p>
            ) : (
              <div className="table-scroll-container" style={{ marginTop: '16px' }}>
                <div className="events-table">
                  <div className="table-header" style={{ gridTemplateColumns: '1.8fr 1.2fr 1.2fr 1fr 1.2fr', gap: '14px' }}>
                    <span>EVENT TITLE & DETAILS</span>
                    <span>SCHEDULE & TIMING</span>
                    <span>VENUE / LOCATION</span>
                    <span>PASSES & SEATS</span>
                    <span>ACTIONS</span>
                  </div>
                  {events.map(ev => (
                    <div className="table-row" key={ev.id} style={{ gridTemplateColumns: '1.8fr 1.2fr 1.2fr 1fr 1.2fr', gap: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {ev.photoUrl ? (
                          <img src={ev.photoUrl} alt={ev.title} style={{ width: '48px', height: '36px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--brand-border-subtle)', flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: '48px', height: '36px', borderRadius: '6px', background: 'var(--panel-subtle)', display: 'grid', placeItems: 'center', color: 'var(--brand-primary)', border: '1px solid var(--line)', flexShrink: 0 }}>
                            <IconSparkles size={16} />
                          </div>
                        )}
                        <div style={{ minWidth: 0 }}>
                          <b style={{ color: 'var(--text-main)', fontSize: '13px', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.title}</b>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                            <span className="badge" style={{ background: 'var(--brand-badge-bg)', color: 'var(--brand-primary)', fontSize: '9px' }}>{ev.eventType}</span>
                            {ev.requiresPayment || (ev.paymentAmount && ev.paymentAmount > 0) ? (
                              <span className="badge badge-admin" style={{ fontSize: '9px' }}>₹{ev.paymentAmount}</span>
                            ) : (
                              <span className="badge badge-student" style={{ fontSize: '9px' }}>FREE</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-main)', fontSize: '12px', fontWeight: 600, display: 'block' }}>{new Date(ev.dateTime).toLocaleDateString()}</span>
                        <small style={{ color: 'var(--text-dim)', fontSize: '11px', display: 'block', marginTop: '2px' }}>{new Date(ev.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-main)', fontSize: '12px', display: 'block' }}>{ev.venue || ev.location || 'Campus / Online'}</span>
                        {ev.coordinatorName && (
                          <small style={{ color: 'var(--text-dim)', fontSize: '10.5px', display: 'block', marginTop: '2px' }}>Coord: {ev.coordinatorName}</small>
                        )}
                      </div>
                      <div>
                        <strong style={{ color: 'var(--brand-primary)', fontSize: '13px' }}>{ev.registrationCount ?? ev._count?.registrations ?? 0}</strong>
                        <small style={{ color: 'var(--text-dim)', fontSize: '11px' }}> / {ev.capacity || '∞'}</small>
                      </div>
                      <div className="action-buttons" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        <button className="action-btn edit-btn" onClick={() => startEditEvent(ev)} title="Edit event settings">Edit</button>
                        <button className="action-btn save-btn" onClick={() => openAnalytics(ev)} title="View attendee passes and check-in roster">Passes</button>
                        <button className="action-btn delete-btn" onClick={() => removeEvent(ev.id)} title="Delete event">Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </article>
        )}

        {/* Analytics & Passes Modal */}
        {analyticsModalEvent && (
          <div className="photo-lightbox" onClick={() => setAnalyticsModalEvent(null)}>
            <div className="photo-lightbox-content" onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-modal)', padding: '24px', borderRadius: '16px', border: '1px solid var(--line)', maxWidth: '1100px', width: '96vw', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <b style={{ color: 'var(--brand-primary)', fontSize: '18px' }}>{analyticsModalEvent.title}</b>
                    <span className="badge badge-president" style={{ fontSize: '10px' }}>{analyticsModalEvent.eventType}</span>
                  </div>
                  <small style={{ display: 'block', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Comprehensive Attendee Pass Roster · {analyticsModalEvent.venue || analyticsModalEvent.location || 'Campus'}
                  </small>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="outline"
                    onClick={() => handleDownloadEventRegistrations(analyticsModalEvent, analyticsData?.registrations)}
                    disabled={!analyticsData?.registrations || analyticsData.registrations.length === 0}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '6px 12px' }}
                    title="Download complete event registrations roster as CSV"
                  >
                    <IconDownload size={13} /> DOWNLOAD ROSTER CSV
                  </button>
                  <button className="lightbox-close" onClick={() => setAnalyticsModalEvent(null)} style={{ position: 'static' }}>✕</button>
                </div>
              </div>

              {/* Stats Summary Bar Side-by-Side HUD */}
              {analyticsData?.stats && (
                <div className="roster-stats-hud">
                  <div className="roster-stat-card">
                    <span className="roster-stat-label">TOTAL REGISTERED</span>
                    <span className="roster-stat-value" style={{ color: 'var(--brand-primary)' }}>{analyticsData.stats.totalRegistrations}</span>
                  </div>
                  <div className="roster-stat-card">
                    <span className="roster-stat-label">CONFIRMED / PAID</span>
                    <span className="roster-stat-value" style={{ color: '#10b981' }}>{analyticsData.stats.confirmed}</span>
                  </div>
                  <div className="roster-stat-card">
                    <span className="roster-stat-label">PENDING UTR</span>
                    <span className="roster-stat-value" style={{ color: '#f59e0b' }}>{analyticsData.stats.pending}</span>
                  </div>
                  <div className="roster-stat-card">
                    <span className="roster-stat-label">VERIFIED REVENUE</span>
                    <span className="roster-stat-value" style={{ color: '#10b981' }}>₹{analyticsData.stats.totalVerifiedRevenue}</span>
                  </div>
                  <div className="roster-stat-card">
                    <span className="roster-stat-label">SEATS REMAINING</span>
                    <span className="roster-stat-value" style={{ color: 'var(--text-main)' }}>{analyticsData.stats.seatsRemaining ?? '∞'}</span>
                  </div>
                </div>
              )}

              {/* Roster Search Bar */}
              <div style={{ marginBottom: '14px' }}>
                <input
                  placeholder="Search by student name, member ID, college, roll number, email, phone, UTR, team..."
                  value={rosterSearch}
                  onChange={e => setRosterSearch(e.target.value)}
                  style={{ width: '100%', height: '38px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)', padding: '0 12px', fontSize: '12px' }}
                />
              </div>

              {loadingAnalytics ? (
                <p className="directory-state">Loading complete registration details...</p>
              ) : !analyticsData?.registrations || analyticsData.registrations.length === 0 ? (
                <p className="directory-state">No student registrations for this event yet.</p>
              ) : (
                (() => {
                  const q = rosterSearch.trim().toLowerCase()
                  const list = (analyticsData.registrations || []).filter(r => {
                    if (!q) return true
                    return (
                      (r.name && r.name.toLowerCase().includes(q)) ||
                      (r.memberName && r.memberName.toLowerCase().includes(q)) ||
                      (r.memberId && r.memberId.toLowerCase().includes(q)) ||
                      (r.rollNumber && r.rollNumber.toLowerCase().includes(q)) ||
                      (r.department && r.department.toLowerCase().includes(q)) ||
                      (r.email && r.email.toLowerCase().includes(q)) ||
                      (r.phone && r.phone.toLowerCase().includes(q)) ||
                      (r.teamName && r.teamName.toLowerCase().includes(q)) ||
                      (r.paymentReference && r.paymentReference.toLowerCase().includes(q)) ||
                      (r.paymentStatus && r.paymentStatus.toLowerCase().includes(q))
                    )
                  })

                  if (list.length === 0) {
                    return <p className="directory-state">No attendees match your search "{rosterSearch}".</p>
                  }

                  return (
                    <div className="table-scroll-container">
                      <div className="sub-table" style={{ minWidth: '980px' }}>
                        <div className="sub-table-header" style={{ gridTemplateColumns: '1.4fr 1.2fr 1fr 1.2fr 1fr 1.1fr' }}>
                          <span>STUDENT & ACADEMICS</span>
                          <span>CONTACT & LOGISTICS</span>
                          <span>SQUAD / MODE</span>
                          <span>PAYMENT & UTR</span>
                          <span>GATE ENTRY</span>
                          <span>ACTIONS</span>
                        </div>
                        {list.map(r => (
                          <div className="sub-table-row" key={r.id} style={{ gridTemplateColumns: '1.4fr 1.2fr 1fr 1.2fr 1fr 1.1fr', alignItems: 'center' }}>
                            {/* Student Column */}
                            <div>
                              <b style={{ color: 'var(--text-main)', fontSize: '13px' }}>{r.name || r.memberName || r.user?.profile?.name || r.memberId}</b>
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                                <span style={{ color: 'var(--brand-primary)', fontFamily: 'monospace', fontSize: '11px', fontWeight: 600 }}>
                                  {r.memberId || r.user?.memberId}
                                </span>
                                <span className="badge" style={{ fontSize: '9px', padding: '1px 6px', background: 'var(--panel-subtle)', color: 'var(--text-muted)' }}>
                                  {r.gender || r.user?.profile?.gender || 'MALE'} {r.age || r.user?.profile?.age ? `· ${r.age || r.user?.profile?.age}y` : ''}
                                </span>
                              </div>
                              <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '2px', lineHeight: '1.3' }}>
                                {r.department || r.user?.profile?.department || r.branch || 'CSE'} {r.year || r.user?.profile?.year ? `· Year ${r.year || r.user?.profile?.year}` : ''}
                              </small>
                              {r.rollNumber && (
                                <small style={{ color: 'var(--text-dim)', display: 'block', fontSize: '10px' }}>
                                  Roll: {r.rollNumber}
                                </small>
                              )}
                            </div>

                            {/* Contact & Logistics */}
                            <div>
                              <small style={{ color: 'var(--text-main)', display: 'block', wordBreak: 'break-all' }}>
                                {r.email || r.user?.profile?.email || 'No email'}
                              </small>
                              <small style={{ color: 'var(--brand-primary)', display: 'block', marginTop: '2px' }}>
                                {r.phone || r.user?.profile?.phone || 'No phone'}
                              </small>
                              <span className="badge" style={{ marginTop: '4px', fontSize: '9px', display: 'inline-block', background: 'var(--panel-subtle)', color: 'var(--text-muted)' }}>
                                {r.residencyType === 'HOSTELLER'
                                  ? (r.hostelType === 'PRIVATE_HOSTEL' ? 'Private PG' : 'College Hostel')
                                  : (r.transportMode === 'COLLEGE_BUS' ? 'College Bus' : r.transportMode === 'PUBLIC_BUS' ? 'Public Bus' : 'Day Scholar')}
                              </span>
                            </div>

                            {/* Squad / Mode */}
                            <div>
                              {r.teamName ? (
                                <div>
                                  <span className="badge" style={{ fontSize: '10px', background: r.isTeamLeader ? 'var(--brand-glow)' : 'var(--panel-subtle)', color: r.isTeamLeader ? 'var(--brand-primary)' : 'var(--text-main)', border: '1px solid var(--line)' }}>
                                    {r.teamName} {r.isTeamLeader ? '(Leader)' : ''}
                                  </span>
                                </div>
                              ) : (
                                <small style={{ color: 'var(--text-muted)', display: 'block' }}>Individual</small>
                              )}
                              {Array.isArray(r.selectedActivities) && r.selectedActivities.length > 0 && (
                                <small style={{ color: '#70ddb4', display: 'block', fontSize: '10px', marginTop: '2px' }}>
                                  {r.selectedActivities.map(a => a.name).join(', ')}
                                </small>
                              )}
                            </div>

                            {/* Payment & UTR */}
                            <div>
                              <strong style={{ color: '#70ddb4', fontSize: '13px' }}>
                                {r.totalAmount > 0 ? `₹${r.totalAmount}` : 'Free Entry'}
                              </strong>
                              {r.paymentReference && (
                                <small style={{ color: 'var(--brand-primary)', display: 'block', fontFamily: 'monospace', fontSize: '10px', marginTop: '2px' }}>
                                  UTR: {r.paymentReference}
                                </small>
                              )}
                              <span className={`badge badge-${(r.paymentStatus || 'free').toLowerCase()}`} style={{ marginTop: '3px', display: 'inline-block', fontSize: '9px' }}>
                                {r.paymentStatus}
                              </span>
                            </div>

                            {/* Gate Entry */}
                            <div>
                              {r.attendanceMarked ? (
                                <div>
                                  <span className="badge" style={{ background: '#064e3b', color: '#6ee7b7', border: '1px solid #10b981', fontSize: '10px' }}>
                                    ✓ ADMITTED
                                  </span>
                                  {r.attendedAt && (
                                    <small style={{ color: 'var(--text-dim)', display: 'block', fontSize: '9px', marginTop: '2px' }}>
                                      {new Date(r.attendedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </small>
                                  )}
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  className="action-btn"
                                  onClick={() => handleCheckInRoster(r.id)}
                                  style={{ fontSize: '10px', padding: '4px 8px', background: 'var(--panel-subtle)', color: 'var(--text-main)', border: '1px solid var(--line)' }}
                                >
                                  Check-in
                                </button>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="action-buttons" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              {(r.paymentStatus === 'SUBMITTED' || r.paymentStatus === 'PENDING') && r.totalAmount > 0 && (
                                <button
                                  className="action-btn save-btn"
                                  onClick={() => handleVerifyRosterUTR(r.id)}
                                  style={{ fontSize: '10px', padding: '4px 8px' }}
                                >
                                  Verify UTR
                                </button>
                              )}
                              <button
                                className="action-btn"
                                onClick={() => setSelectedRosterPass(r)}
                                style={{ fontSize: '10px', padding: '4px 8px', background: 'var(--brand-glow)', color: 'var(--brand-primary)', border: '1px solid var(--line)' }}
                              >
                                Full Details
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()
              )}
            </div>
          </div>
        )}

        {/* Attendee Full Detail Card Modal */}
        {selectedRosterPass && (
          <div className="photo-lightbox" onClick={() => setSelectedRosterPass(null)}>
            <div className="photo-lightbox-content" onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-modal)', padding: '28px', borderRadius: '16px', border: '1px solid var(--line)', maxWidth: '620px', width: '95vw', maxHeight: '88vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span className="badge badge-president">{selectedRosterPass.eventTitle || analyticsModalEvent?.title || 'ATTENDEE PASS'}</span>
                <button className="lightbox-close" onClick={() => setSelectedRosterPass(null)} style={{ position: 'static' }}>✕</button>
              </div>

              {selectedRosterPass.qrCodeData && (
                <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                  <div style={{ background: '#fff', padding: '12px', borderRadius: '12px', display: 'inline-block' }}>
                    <img src={selectedRosterPass.qrCodeData} alt="Pass QR" style={{ width: '150px', height: '150px', imageRendering: 'pixelated' }} />
                  </div>
                </div>
              )}

              <h2 style={{ font: '700 20px Syne', color: 'var(--text-main)', margin: '0 0 4px', textAlign: 'center' }}>
                {selectedRosterPass.name || selectedRosterPass.memberName || selectedRosterPass.user?.profile?.name || selectedRosterPass.memberId}
              </h2>
              <p style={{ color: 'var(--brand-primary)', fontFamily: 'monospace', fontSize: '12px', margin: '0 0 16px', textAlign: 'center' }}>
                PASS ID: {selectedRosterPass.id} · MEMBER: {selectedRosterPass.memberId || selectedRosterPass.user?.memberId}
              </p>

              {/* Full Details Grid */}
              <div style={{ background: 'var(--panel-subtle)', borderRadius: '12px', padding: '16px', fontSize: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', color: 'var(--text-muted)', border: '1px solid var(--line)' }}>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>COLLEGE / INSTITUTION</span>
                  <b style={{ color: 'var(--text-main)', display: 'block', marginTop: '2px' }}>
                    {selectedRosterPass.department || selectedRosterPass.user?.profile?.department || 'Malla Reddy (MR) Deemed to be University'}
                  </b>
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ACADEMIC YEAR & ROLL</span>
                  <b style={{ color: 'var(--text-main)', display: 'block', marginTop: '2px' }}>
                    Year {selectedRosterPass.year || selectedRosterPass.user?.profile?.year || '1'} · Roll: {selectedRosterPass.rollNumber || selectedRosterPass.user?.profile?.rollNumber || '---'}
                  </b>
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>EMAIL ADDRESS</span>
                  <b style={{ color: 'var(--text-main)', display: 'block', marginTop: '2px', wordBreak: 'break-all' }}>
                    {selectedRosterPass.email || selectedRosterPass.user?.profile?.email || '---'}
                  </b>
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>PHONE & EMERGENCY</span>
                  <b style={{ color: 'var(--text-main)', display: 'block', marginTop: '2px' }}>
                    {selectedRosterPass.phone || selectedRosterPass.user?.profile?.phone || '---'} {selectedRosterPass.emergencyContact ? `(Emerg: ${selectedRosterPass.emergencyContact})` : ''}
                  </b>
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>GENDER & AGE</span>
                  <b style={{ color: 'var(--text-main)', display: 'block', marginTop: '2px' }}>
                    {selectedRosterPass.gender || selectedRosterPass.user?.profile?.gender || 'MALE'} · {selectedRosterPass.age || selectedRosterPass.user?.profile?.age || '---'} yrs
                  </b>
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>RESIDENCY & COMMUTE</span>
                  <b style={{ color: 'var(--text-main)', display: 'block', marginTop: '2px' }}>
                    {selectedRosterPass.residencyType === 'HOSTELLER'
                      ? (selectedRosterPass.hostelType === 'PRIVATE_HOSTEL' ? 'Private PG / Hostel' : 'College Hostel')
                      : (selectedRosterPass.transportMode === 'COLLEGE_BUS' ? 'College Bus Commuter' : selectedRosterPass.transportMode === 'PUBLIC_BUS' ? 'Public Bus' : 'Day Scholar')}
                  </b>
                </div>
                {selectedRosterPass.teamName && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>TEAM SQUAD</span>
                    <b style={{ color: 'var(--brand-primary)', display: 'block', marginTop: '2px' }}>
                      {selectedRosterPass.teamName} {selectedRosterPass.isTeamLeader ? '★ Squad Leader' : '· Squad Member'}
                    </b>
                  </div>
                )}
                <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--line)', paddingTop: '10px', marginTop: '4px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>PAYMENT & UTR</span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <strong style={{ color: '#70ddb4', fontSize: '14px' }}>
                        {selectedRosterPass.totalAmount > 0 ? `₹${selectedRosterPass.totalAmount}` : 'Free Entry'}
                      </strong>
                      <span className={`badge badge-${(selectedRosterPass.paymentStatus || 'free').toLowerCase()}`} style={{ marginLeft: '8px' }}>
                        {selectedRosterPass.paymentStatus}
                      </span>
                      {selectedRosterPass.paymentReference && (
                        <span style={{ display: 'block', color: 'var(--brand-primary)', fontFamily: 'monospace', fontSize: '11px', marginTop: '2px' }}>
                          UTR: {selectedRosterPass.paymentReference}
                        </span>
                      )}
                    </div>
                    {selectedRosterPass.paymentProofUrl && (
                      <a
                        href={selectedRosterPass.paymentProofUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="action-btn"
                        style={{ fontSize: '10px', padding: '4px 10px', background: 'var(--panel-elevated)', color: 'var(--brand-primary)', border: '1px solid var(--line)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        VIEW PAYMENT PROOF ↗
                      </a>
                    )}
                  </div>
                </div>

                {/* Custom Form Data (if any) */}
                {selectedRosterPass.formData && typeof selectedRosterPass.formData === 'object' && Object.keys(selectedRosterPass.formData).length > 0 && (
                  <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--line)', paddingTop: '10px', marginTop: '4px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>CUSTOM FORM RESPONSES</span>
                    <div style={{ marginTop: '6px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      {Object.entries(selectedRosterPass.formData).map(([k, v]) => (
                        <div key={k} style={{ background: 'var(--bg-input)', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--line)' }}>
                          <small style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10px' }}>{k}</small>
                          <span style={{ color: 'var(--text-main)', fontSize: '11px', fontWeight: 600 }}>{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ marginTop: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {(selectedRosterPass.paymentStatus === 'SUBMITTED' || selectedRosterPass.paymentStatus === 'PENDING') && selectedRosterPass.totalAmount > 0 && (
                  <button
                    type="button"
                    className="primary"
                    onClick={() => handleVerifyRosterUTR(selectedRosterPass.id)}
                    style={{ flex: 1, height: '38px', fontSize: '11px' }}
                  >
                    VERIFY UTR & ACTIVATE
                  </button>
                )}
                {!selectedRosterPass.attendanceMarked && (
                  <button
                    type="button"
                    className="action-btn save-btn"
                    onClick={() => handleCheckInRoster(selectedRosterPass.id)}
                    style={{ flex: 1, height: '38px', fontSize: '11px' }}
                  >
                    RECORD GATE ENTRY
                  </button>
                )}
                <button
                  type="button"
                  className="action-btn"
                  onClick={() => setSelectedRosterPass(null)}
                  style={{ height: '38px', padding: '0 16px', background: 'var(--panel-elevated)', color: 'var(--text-main)', border: '1px solid var(--line)', fontSize: '11px' }}
                >
                  CLOSE
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </LivePortal>
  )
}

// ----------------------------------------------------
// Event Form URL Utilities (Two-Form Support: Pre-Registration & Post-Completion)
// ----------------------------------------------------
function getEventFormUrls(ev) {
  if (!ev) return { registrationFormUrl: null, completionFormUrl: null }
  let registrationFormUrl = null
  let completionFormUrl = null

  if (ev.notes) {
    try {
      const parsed = JSON.parse(ev.notes)
      if (parsed && typeof parsed === 'object') {
        registrationFormUrl = parsed.registrationFormUrl || parsed.preRegistrationFormUrl || null
        completionFormUrl = parsed.completionFormUrl || parsed.postCompletionFormUrl || null
      }
    } catch {
      if (/^https?:\/\//i.test(ev.notes.trim())) {
        registrationFormUrl = ev.notes.trim()
      }
    }
  }

  if (!registrationFormUrl || !completionFormUrl) {
    const texts = [ev.description, ev.rules, ev.agenda, ev.shortDescription]
    for (const text of texts) {
      if (!text) continue
      const matches = text.match(/https?:\/\/[^\s<>"')]+/gi)
      if (matches && matches.length > 0) {
        for (const rawUrl of matches) {
          const cleanUrl = rawUrl.replace(/[.,;)]+$/, '')
          if (!registrationFormUrl) {
            registrationFormUrl = cleanUrl
          } else if (!completionFormUrl && cleanUrl !== registrationFormUrl) {
            completionFormUrl = cleanUrl
          }
        }
      }
    }
  }

  return { registrationFormUrl, completionFormUrl }
}

function extractFormUrl(ev) {
  return getEventFormUrls(ev).registrationFormUrl
}

function getEmbeddableFormUrl(url) {
  if (!url) return null
  try {
    const u = new URL(url)
    if (u.hostname.includes('docs.google.com') && u.pathname.includes('/forms/')) {
      if (!u.pathname.endsWith('/viewform')) {
        u.pathname = u.pathname.replace(/\/+$/, '') + '/viewform'
      }
      u.searchParams.set('embedded', 'true')
      return u.toString()
    }
  } catch {}
  return url
}

function renderTextWithLinks(text) {
  if (!text) return null
  const urlRegex = /(https?:\/\/[^\s<]+)/g
  const parts = text.split(urlRegex)
  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      const cleanUrl = part.replace(/[.,;)]+$/, '')
      const trailing = part.slice(cleanUrl.length)
      return (
        <span key={i}>
          <a
            href={cleanUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: 'var(--brand-primary)',
              textDecoration: 'underline',
              wordBreak: 'break-all',
              fontWeight: 600,
            }}
          >
            {cleanUrl} ↗
          </a>
          {trailing}
        </span>
      )
    }
    return part
  })
}

// ----------------------------------------------------
// Event Detail & Registration Page (Student)
// ----------------------------------------------------
function StudentEventDetail({ user, eventId, logout, onNavigate }) {
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [selectedActivities, setSelectedActivities] = useState([])
  const [proofPreview, setProofPreview] = useState('')
  const [subRequired, setSubRequired] = useState(false)

  const isHackathonOrTech = Boolean(
    event?.title?.toLowerCase().includes('hack') ||
    event?.eventType?.toLowerCase().includes('hack') ||
    event?.eventType?.toLowerCase().includes('tech') ||
    event?.isTeamEvent ||
    /hackathon|coding|ctf|tech/i.test(`${event?.title || ''} ${event?.description || ''} ${event?.eventType || ''}`)
  )

  // Step 1: Form and Custom Fields State
  const [formAcknowledged, setFormAcknowledged] = useState(false)
  const [showEmbedForm, setShowEmbedForm] = useState(false)
  const [copiedUpi, setCopiedUpi] = useState(false)
  const [copiedFormUrl, setCopiedFormUrl] = useState(false)
  const [customFormAnswers, setCustomFormAnswers] = useState({})

  // Attendee & Hackathon Demographics State (Mandatory Details)
  const [fullName, setFullName] = useState(user.profile?.name || user.name || '')
  const [rollNumber, setRollNumber] = useState(user.profile?.rollNumber || user.memberId || '')
  const [department, setDepartment] = useState(user.profile?.department || 'Cyber Security')
  const [academicYear, setAcademicYear] = useState(user.profile?.year || 2)
  const [phone, setPhone] = useState(user.profile?.phone || '')
  const [collegeName, setCollegeName] = useState('Malla Reddy (MR) Deemed to be University')
  const [githubUrl, setGithubUrl] = useState(user.profile?.githubUrl || '')
  const [projectDomain, setProjectDomain] = useState('Cyber Security / Ethical Hacking')

  // Logistics & Demographics State
  const [gender, setGender] = useState(user.profile?.gender || 'MALE')
  const [age, setAge] = useState(user.profile?.age || 19)
  const [residencyType, setResidencyType] = useState('DAY_SCHOLAR')
  const [transportMode, setTransportMode] = useState('COLLEGE_BUS')
  const [hostelType, setHostelType] = useState('COLLEGE_HOSTEL')
  const [emergencyContact, setEmergencyContact] = useState('')
  const [paymentReference, setPaymentReference] = useState('')

  // Post-Completion & Hackathon Project Submission Form (Form 2) State
  const [completionConfirmed, setCompletionConfirmed] = useState(false)
  const [completionProjectUrl, setCompletionProjectUrl] = useState('')
  const [completionDemoUrl, setCompletionDemoUrl] = useState('')
  const [completionNotes, setCompletionNotes] = useState('')
  const [submittingCompletion, setSubmittingCompletion] = useState(false)
  const [completionMessage, setCompletionMessage] = useState('')
  const [showEmbedCompletionForm, setShowEmbedCompletionForm] = useState(false)

  // Team Formation State
  const [teamNameInput, setTeamNameInput] = useState('')
  const [memberLookupInput, setMemberLookupInput] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState('')
  const [draftMembers, setDraftMembers] = useState([])
  const [teamSubmitting, setTeamSubmitting] = useState(false)

  // My Invites State
  const [pendingInvites, setPendingInvites] = useState([])
  const [respondingInviteId, setRespondingInviteId] = useState(null)

  function loadEventAndInvites() {
    let mounted = true
    setLoading(true)
    Promise.all([
      memberApi.getEventDetails(eventId),
      memberApi.listMyTeamInvites().catch(() => ({ invites: [] })),
    ])
      .then(([evRes, invRes]) => {
        if (!mounted) return
        setEvent(evRes.event)
        const relevantInvites = (invRes.invites || []).filter(i => i.eventId === eventId)
        setPendingInvites(relevantInvites)
      })
      .catch(err => { if (mounted) setError(err.message) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }

  useEffect(() => {
    return loadEventAndInvites()
  }, [eventId])

  function toggleActivity(actId) {
    if (event?.allowMultipleActivities) {
      setSelectedActivities(c => (c.includes(actId) ? c.filter(id => id !== actId) : [...c, actId]))
    } else {
      setSelectedActivities([actId])
    }
  }

  async function handleLookupMember() {
    const q = memberLookupInput.trim().toUpperCase()
    if (!q || q.length < 3) {
      setLookupError('Enter at least 3 characters of Member ID.')
      return
    }
    if (q === user.memberId?.toUpperCase()) {
      setLookupError('You are already the team leader.')
      return
    }
    if (draftMembers.some(m => m.memberId?.toUpperCase() === q)) {
      setLookupError('Member already added to team draft.')
      return
    }

    setLookupLoading(true)
    setLookupError('')
    try {
      const res = await memberApi.lookupMember(q)
      setDraftMembers(c => [...c, res.member])
      setMemberLookupInput('')
    } catch (err) {
      setLookupError(err.message || 'Student not found.')
    } finally {
      setLookupLoading(false)
    }
  }

  function removeDraftMember(mId) {
    setDraftMembers(c => c.filter(m => m.id !== mId))
  }

  async function handleCreateTeam() {
    if (!teamNameInput.trim()) {
      setError('Please provide a team name.')
      return
    }
    setTeamSubmitting(true)
    setError('')
    setMessage('')
    try {
      await memberApi.createEventTeam(eventId, {
        teamName: teamNameInput.trim(),
        invitedMemberIds: draftMembers.map(m => m.id),
      })
      setMessage(`Team "${teamNameInput.trim()}" created! Invitations dispatched to team members.`)
      setTeamNameInput('')
      setDraftMembers([])
      loadEventAndInvites()
    } catch (err) {
      setError(err.message || 'Unable to create team.')
    } finally {
      setTeamSubmitting(false)
    }
  }

  async function handleRespondInvite(inviteId, accept) {
    setRespondingInviteId(inviteId)
    setError('')
    setMessage('')
    try {
      const res = await memberApi.respondTeamInvite(inviteId, accept)
      setMessage(res.message)
      loadEventAndInvites()
    } catch (err) {
      setError(err.message || 'Failed to respond to team invite.')
    } finally {
      setRespondingInviteId(null)
    }
  }

  async function handleRemoveTeamMember(teamId, memberUserId) {
    if (!confirm('Are you sure you want to remove this member from your team?')) return
    setError('')
    try {
      await memberApi.removeTeamMember(teamId, memberUserId)
      setMessage('Member removed from team.')
      loadEventAndInvites()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleRegister(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    setSubRequired(false)

    // Team validation
    if (event.isTeamEvent) {
      if (!event.userTeam) {
        setError('Please create or join a team first before registering.')
        return
      }
      if (!event.userTeam.isLeader) {
        setError('Only the team leader can submit the final team registration & payment.')
        return
      }
      const acceptedCount = (event.userTeam.members || []).filter(m => m.status === 'ACCEPTED').length
      const minReq = event.minTeamSize || 2
      if (acceptedCount < minReq) {
        setError(`Your team requires at least ${minReq} accepted members to register (currently ${acceptedCount} accepted).`)
        return
      }

      // If team rules mention female / girl requirement
      if (event.teamRules && /female|girl|woman/i.test(event.teamRules)) {
        const hasFemale = (event.userTeam.members || []).some(m => m.gender === 'FEMALE') || gender === 'FEMALE'
        if (!hasFemale) {
          setError('Event rules require at least 1 female team member. Please invite a female participant to join your team.')
          return
        }
      }
    }

    const formUrls = getEventFormUrls(event)
    const formUrl = formUrls.registrationFormUrl

    // Attendee & Hackathon Details Validation (Strict - Cannot bypass)
    if (!fullName.trim()) {
      setError('Please enter your Full Name in Step 1.')
      return
    }
    if (!rollNumber.trim()) {
      setError('Please enter your Roll Number / Student ID in Step 1.')
      return
    }
    if (!phone.trim() || phone.replace(/\D/g, '').length < 10) {
      setError('Please enter a valid 10-digit contact mobile / WhatsApp number in Step 1.')
      return
    }
    if (!department.trim()) {
      setError('Please select or specify your department / branch in Step 1.')
      return
    }
    if (isHackathonOrTech && !githubUrl.trim()) {
      setError('GitHub Profile URL is required for Hackathon & technical events. Please provide your GitHub link in Step 1.')
      return
    }
    if (!emergencyContact.trim() || emergencyContact.replace(/\D/g, '').length < 10) {
      setError('Please enter a valid 10-digit emergency contact phone number in Step 1.')
      return
    }

    // Form completion validation if a registration form link exists
    if (formUrl && !formAcknowledged) {
      setError('Please open and complete the official Pre-Registration Google Form (Step 1), then check the confirmation box before registering.')
      return
    }

    if (totalPrice > 0 && !paymentReference.trim()) {
      setError('Please enter your 12-digit UPI UTR / Transaction Reference ID for payment verification (Step 2).')
      return
    }

    const payload = {
      selectedActivityIds: selectedActivities,
      paymentReference: paymentReference.trim() || null,
      paymentProofUrl: proofPreview || null,
      branch: department.trim(),
      year: Number(academicYear) || 1,
      gender,
      age: age ? Number(age) : null,
      residencyType,
      transportMode: residencyType === 'DAY_SCHOLAR' ? transportMode : null,
      hostelType: residencyType === 'HOSTELLER' ? hostelType : null,
      emergencyContact: emergencyContact.trim() || null,
      teamName: event.userTeam?.teamName || null,
      teamId: event.userTeam?.id || null,
      isTeamLeader: Boolean(event.userTeam?.isLeader),
      github: githubUrl.trim() || null,
      formData: {
        fullName: fullName.trim(),
        rollNumber: rollNumber.trim(),
        department: department.trim(),
        academicYear: Number(academicYear),
        phone: phone.trim(),
        collegeName: collegeName.trim(),
        githubUrl: githubUrl.trim(),
        projectDomain: projectDomain.trim(),
        registrationFormUrl: formUrl || null,
        formAcknowledged: Boolean(formAcknowledged),
        customAnswers: customFormAnswers,
      },
    }

    setSubmitting(true)
    try {
      await memberApi.registerForEvent(eventId, payload)
      setMessage('✓ Registration & Payment Confirmed! Your digital pass and entry QR are active and ready in your Pass Wallet.')
      loadEventAndInvites()
    } catch (err) {
      if (err.code === 'SUBSCRIPTION_REQUIRED' || err.message?.includes('membership is inactive')) {
        setSubRequired(true)
      }
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSubmitCompletion(e) {
    e?.preventDefault?.()
    setError('')
    setCompletionMessage('')
    if (!completionConfirmed) {
      setError('Please check the confirmation box confirming you have submitted your project on the post-completion form.')
      return
    }
    setSubmittingCompletion(true)
    try {
      const res = await memberApi.submitEventCompletion(eventId, {
        projectUrl: completionProjectUrl.trim() || null,
        demoUrl: completionDemoUrl.trim() || null,
        completionConfirmed: true,
        notes: completionNotes.trim() || null,
      })
      setCompletionMessage(res.message || '✓ Hackathon project and event completion submitted successfully!')
      loadEventAndInvites()
    } catch (err) {
      setError(err.message || 'Failed to submit event completion.')
    } finally {
      setSubmittingCompletion(false)
    }
  }

  if (loading) {
    return (
      <LivePortal user={user} logout={logout} activeTab="student-events" onNavigate={onNavigate} title="EVENT DETAILS">
        <p className="directory-state">Loading event details...</p>
      </LivePortal>
    )
  }

  if (!event) {
    return (
      <LivePortal user={user} logout={logout} activeTab="student-events" onNavigate={onNavigate} title="EVENT DETAILS">
        <button className="back-button" onClick={() => onNavigate('student-events')}>← BACK TO EVENTS</button>
        <p className="directory-state">Event not found.</p>
      </LivePortal>
    )
  }

  const basePrice = event.paymentAmount || 0
  const activityPrice = (event.activities || [])
    .filter(a => selectedActivities.includes(a.id))
    .reduce((sum, a) => sum + (Number(a.price) || 0), 0)
  const totalPrice = basePrice + activityPrice

  const userTeam = event.userTeam
  const isLeader = userTeam?.isLeader
  const acceptedMembersCount = userTeam ? userTeam.members.filter(m => m.status === 'ACCEPTED').length : 0
  const satisfiesMinTeam = !event.isTeamEvent || (userTeam && acceptedMembersCount >= (event.minTeamSize || 2))
  const ruleRequiresFemale = event.isTeamEvent && event.teamRules && /female|girl|woman/i.test(event.teamRules)
  const hasFemaleMember = userTeam && (userTeam.members.some(m => m.gender === 'FEMALE') || gender === 'FEMALE')

  const formUrls = getEventFormUrls(event)
  const formUrl = formUrls.registrationFormUrl || extractFormUrl(event)
  const completionFormUrl = formUrls.completionFormUrl
  const embeddableFormUrl = getEmbeddableFormUrl(formUrl)
  const isGoogleForm = formUrl && (formUrl.includes('forms.gle') || formUrl.includes('docs.google.com/forms'))
  const isGoogleCompletionForm = completionFormUrl && (completionFormUrl.includes('forms.gle') || completionFormUrl.includes('docs.google.com/forms'))
  const isCompletionSubmitted = Boolean(
    event?.userRegistration?.formData?.completionConfirmed ||
    event?.userRegistration?.status === 'COMPLETED'
  )

  return (
    <LivePortal user={user} logout={logout} activeTab="student-events" onNavigate={onNavigate} title="EVENT DETAILS">
      <section className="event-detail-page">
        <button className="back-button" onClick={() => onNavigate('student-events')}>← BACK TO EVENTS CATALOG</button>

        {message && <p className="member-form-success" style={{ marginTop: '10px' }}>{message}</p>}
        {error && <p className="member-form-error" style={{ marginTop: '10px' }}>{error}</p>}

        {subRequired && (
          <div className="pending-alert-banner" style={{ background: '#3a1818', borderColor: '#ef4444', color: '#ffcdd2', marginTop: '14px' }}>
            <div>
              <b>Active Student Membership Required</b>
              <p style={{ margin: '2px 0 0', fontSize: '11px' }}>
                Please subscribe to unlock event passes and activities.
              </p>
            </div>
            <button type="button" onClick={() => onNavigate('student-membership')} style={{ background: '#ef4444', color: '#fff' }}>
              SUBSCRIBE NOW →
            </button>
          </div>
        )}

        <div className="event-detail-hero" style={{ marginTop: '16px' }}>
          <div className="event-detail-main">
            <div className="event-detail-banner">
              {event.photoUrl ? (
                <img src={event.photoUrl} alt={event.title} />
              ) : (
                <div className="event-banner-fallback" style={{ height: '100%' }}>
                  <strong>{event.eventType.toUpperCase()}</strong>
                </div>
              )}
            </div>

            <div className="event-info-box">
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="badge badge-president">{event.eventType}</span>
                {event.isTeamEvent ? (
                  <span className="badge" style={{ background: 'var(--brand-badge-bg)', color: 'var(--brand-badge-color)' }}>
                    TEAM EVENT ({event.minTeamSize} - {event.maxTeamSize} Members)
                  </span>
                ) : (
                  <span className="badge" style={{ background: 'var(--panel-subtle)', color: 'var(--text-muted)' }}>
                    INDIVIDUAL ENTRY
                  </span>
                )}
                {event.requiresPayment ? (
                  <span className="badge" style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#fef08a', border: '1px solid #eab30866' }}>
                    PAID · ₹{event.paymentAmount}
                  </span>
                ) : (
                  <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#6ee7b7', border: '1px solid #10b98166' }}>
                    FREE ENTRY
                  </span>
                )}
              </div>

              <h1 style={{ font: '700 clamp(24px, 3vw, 36px) Syne', color: 'var(--text-main)', margin: '14px 0 8px' }}>{event.title}</h1>

              {/* Form Callout Banner on Left Column */}
              {formUrl && (
                <div style={{
                  margin: '16px 0',
                  padding: '14px 16px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, rgba(82, 187, 245, 0.12), rgba(20, 80, 140, 0.2))',
                  border: '1.5px solid var(--brand-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '22px' }}>📝</span>
                    <div>
                      <b style={{ color: 'var(--text-main)', fontSize: '13px' }}>
                        {isGoogleForm ? 'Official Google Form Attached' : 'Official Registration Form Attached'}
                      </b>
                      <p style={{ margin: '2px 0 0', color: 'var(--text-muted)', fontSize: '11.5px' }}>
                        Required for event participation. Complete Step 1 on the right or click below.
                      </p>
                    </div>
                  </div>
                  <a
                    href={formUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'var(--brand-primary)',
                      color: '#07121c',
                      padding: '8px 14px',
                      borderRadius: '6px',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      textDecoration: 'none',
                    }}
                  >
                    Open Form ↗
                  </a>
                </div>
              )}

              <div style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.7', whiteSpace: 'pre-line' }}>
                {renderTextWithLinks(event.description || event.shortDescription)}
              </div>

              {event.teamRules && (
                <div style={{ marginTop: '20px', padding: '14px', borderRadius: '8px', background: 'var(--panel-subtle)', border: '1px solid var(--line)' }}>
                  <b style={{ color: 'var(--brand-primary)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <IconShieldCheck size={14} /> TEAM COMPOSITION & GUIDELINES:
                  </b>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-main)', lineHeight: '1.5' }}>
                    {event.teamRules}
                  </p>
                </div>
              )}

              {event.agenda && (
                <div style={{ marginTop: '24px' }}>
                  <b style={{ color: 'var(--brand-primary)', fontSize: '13px' }}>AGENDA & SCHEDULE</b>
                  <pre style={{ color: 'var(--text-main)', font: '12px Manrope', whiteSpace: 'pre-wrap', marginTop: '8px', padding: '14px', background: 'var(--bg-input)', borderRadius: '8px', border: '1px solid var(--line)' }}>{event.agenda}</pre>
                </div>
              )}

              {event.rules && (
                <div style={{ marginTop: '24px' }}>
                  <b style={{ color: 'var(--brand-primary)', fontSize: '13px' }}>RULES & ETHICS</b>
                  <pre style={{ color: 'var(--text-main)', font: '12px Manrope', whiteSpace: 'pre-wrap', marginTop: '8px', padding: '14px', background: 'var(--bg-input)', borderRadius: '8px', border: '1px solid var(--line)' }}>{event.rules}</pre>
                </div>
              )}
            </div>
          </div>

          {/* Registration Form & Team Squad Sidebar */}
          <div>
            <article className="account-form-card" style={{ position: 'sticky', top: '20px' }}>
              <p className="eyebrow">REGISTRATION & PASS</p>
              <h2>{event.isRegistered ? 'Registration Confirmed' : 'Reserve Your Slot'}</h2>

              <div style={{ margin: '14px 0', padding: '12px', background: 'var(--panel-subtle)', borderRadius: '8px', border: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  <span>Date:</span>
                  <b style={{ color: 'var(--text-main)' }}>{new Date(event.dateTime).toLocaleDateString()}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  <span>Venue:</span>
                  <b style={{ color: 'var(--text-main)' }}>{event.venue || event.location || 'Campus'}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#829bb0' }}>
                  <span>Coordinator:</span>
                  <b style={{ color: '#85d7ff' }}>{event.coordinatorName || 'Club Leadership'}</b>
                </div>
              </div>

              {event.isRegistered ? (
                <div style={{ padding: '16px 0' }}>
                  <div style={{ textAlign: 'center', padding: '16px', background: 'var(--panel-subtle)', borderRadius: '12px', border: '1px solid var(--line)', marginBottom: '16px' }}>
                    <span className="badge badge-registered" style={{ fontSize: '12px', padding: '6px 14px' }}>
                      PASS ACTIVE & VERIFIED
                    </span>
                    <p style={{ color: '#829bb0', fontSize: '12px', marginTop: '10px' }}>
                      {event.userRegistration?.teamName ? `Team: ${event.userRegistration.teamName} · ` : ''}
                      Your digital pass QR is available in your Pass Wallet.
                    </p>
                    <button className="outline" type="button" onClick={() => onNavigate('student-registrations')} style={{ marginTop: '8px' }}>
                      VIEW MY PASSES →
                    </button>
                  </div>

                  {/* FORM 2: POST-COMPLETION / HACKATHON PROJECT SUBMISSION */}
                  {completionFormUrl && (
                    <div>
                      {isCompletionSubmitted ? (
                        <div style={{ padding: '18px', background: 'rgba(16, 185, 129, 0.12)', border: '1.5px solid #10b981', borderRadius: '12px', textAlign: 'center' }}>
                          <span style={{ fontSize: '32px', display: 'block', marginBottom: '6px' }}>🏆</span>
                          <b style={{ color: '#10b981', fontSize: '14px', display: 'block' }}>
                            Full Hackathon & Event Participation Completed!
                          </b>
                          <p style={{ color: 'var(--text-muted)', fontSize: '11.5px', margin: '6px 0 10px' }}>
                            Your project submission and post-completion form have been recorded and verified. You are eligible for the official event certificate.
                          </p>
                          {event.userRegistration?.github && (
                            <small style={{ color: 'var(--brand-primary)', display: 'block', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                              Repository: {event.userRegistration.github}
                            </small>
                          )}
                        </div>
                      ) : (
                        <div style={{ padding: '18px', background: 'var(--panel-subtle)', border: '1.5px solid #10b98188', borderRadius: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
                            <b style={{ color: '#10b981', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>🚀</span> 2. HACKATHON PROJECT SUBMISSION
                            </b>
                            <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.18)', color: '#10b981', fontSize: '9px', fontWeight: 700 }}>
                              FORM 2 REQUIRED
                            </span>
                          </div>

                          <p style={{ color: 'var(--text-muted)', fontSize: '11.5px', margin: '0 0 12px', lineHeight: 1.4 }}>
                            After attending the hackathon or event, submit your final project details and the completion form below to conclude your participation.
                          </p>

                          {/* Direct Button to Open Form 2 */}
                          <a
                            href={completionFormUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="form-open-btn"
                            style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', textAlign: 'center', display: 'block', marginBottom: '10px', textDecoration: 'none' }}
                          >
                            <span>👉</span> OPEN {isGoogleCompletionForm ? 'GOOGLE COMPLETION FORM' : 'POST-COMPLETION FORM'} ↗
                          </a>

                          <button
                            type="button"
                            className="outline"
                            onClick={() => setShowEmbedCompletionForm(prev => !prev)}
                            style={{ width: '100%', padding: '6px', fontSize: '11px', marginBottom: '12px' }}
                          >
                            {showEmbedCompletionForm ? '▲ Hide Inline Form' : '▼ Fill Completion Form Inline'}
                          </button>

                          {showEmbedCompletionForm && (
                            <div className="form-embed-container" style={{ marginBottom: '12px' }}>
                              <iframe
                                src={getEmbeddableFormUrl(completionFormUrl)}
                                title="Post-Completion Form"
                                loading="lazy"
                              />
                            </div>
                          )}

                          {/* Project Details Inputs */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                            <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              Project GitHub Repository URL
                              <input
                                type="url"
                                placeholder="https://github.com/your-username/your-project"
                                value={completionProjectUrl}
                                onChange={e => setCompletionProjectUrl(e.target.value)}
                                style={{ width: '100%', marginTop: '3px', height: '34px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text-main)', padding: '0 10px', fontSize: '11.5px' }}
                              />
                            </label>

                            <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              Project Live Demo / Drive Presentation Link (Optional)
                              <input
                                type="url"
                                placeholder="https://your-demo.vercel.app"
                                value={completionDemoUrl}
                                onChange={e => setCompletionDemoUrl(e.target.value)}
                                style={{ width: '100%', marginTop: '3px', height: '34px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text-main)', padding: '0 10px', fontSize: '11.5px' }}
                              />
                            </label>
                          </div>

                          <label className="form-ack-checkbox" style={{
                            background: completionConfirmed ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-card)',
                            border: completionConfirmed ? '1px solid #10b98166' : '1px solid var(--line)',
                            marginBottom: '12px',
                          }}>
                            <input
                              type="checkbox"
                              checked={completionConfirmed}
                              onChange={e => setCompletionConfirmed(e.target.checked)}
                            />
                            <div>
                              <b style={{ color: completionConfirmed ? '#10b981' : 'var(--text-main)', display: 'block', fontSize: '11.5px' }}>
                                I confirm I have submitted the hackathon project & completion form
                              </b>
                              <small style={{ color: 'var(--text-muted)', fontSize: '10.5px' }}>
                                Tick this box once you have submitted your project on the Google Form.
                              </small>
                            </div>
                          </label>

                          <button
                            type="button"
                            className="primary"
                            disabled={submittingCompletion || !completionConfirmed}
                            onClick={handleSubmitCompletion}
                            style={{ width: '100%', background: '#10b981', color: '#07121c', fontWeight: 700 }}
                          >
                            {submittingCompletion ? 'FINALIZING SUBMISSION…' : '✓ SUBMIT PROJECT & COMPLETE PARTICIPATION'}
                          </button>

                          {completionMessage && <p className="member-form-success" style={{ marginTop: '10px' }}>{completionMessage}</p>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  {/* Pending Team Invitations for this event */}
                  {pendingInvites.length > 0 && !userTeam && (
                    <div style={{ background: 'var(--brand-glow)', border: '1px solid var(--brand-primary)', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
                      <b style={{ color: 'var(--brand-primary)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <IconSparkles size={14} /> PENDING TEAM INVITATION
                      </b>
                      {pendingInvites.map(inv => (
                        <div key={inv.inviteId} style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-main)' }}>
                          <p style={{ margin: '0 0 8px' }}>
                            <b>{inv.leaderName}</b> ({inv.leaderMemberId}) invited you to join <b>"{inv.teamName}"</b>.
                          </p>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              type="button"
                              className="primary"
                              disabled={respondingInviteId === inv.inviteId}
                              onClick={() => handleRespondInvite(inv.inviteId, true)}
                              style={{ padding: '6px 12px', fontSize: '11px', flex: 1 }}
                            >
                              ACCEPT
                            </button>
                            <button
                              type="button"
                              className="action-btn cancel-btn"
                              disabled={respondingInviteId === inv.inviteId}
                              onClick={() => handleRespondInvite(inv.inviteId, false)}
                              style={{ padding: '6px 12px', fontSize: '11px', flex: 1 }}
                            >
                              DECLINE
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Team Participation Flow */}
                  {event.isTeamEvent && (
                    <div style={{ background: 'var(--panel-subtle)', border: '1px solid var(--line)', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
                      <b style={{ color: 'var(--brand-primary)', fontSize: '12px', display: 'block', marginBottom: '8px' }}>
                        TEAM FORMATION ({event.minTeamSize} - {event.maxTeamSize} MEMBERS)
                      </b>

                      {userTeam ? (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
                              Team: {userTeam.teamName}
                            </span>
                            <span className="badge" style={{ fontSize: '10px', background: isLeader ? 'var(--brand-badge-bg)' : 'var(--panel-elevated)', color: isLeader ? 'var(--brand-primary)' : 'var(--text-muted)' }}>
                              {isLeader ? 'LEADER' : 'MEMBER'}
                            </span>
                          </div>

                          {/* Member List */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', margin: '10px 0' }}>
                            {userTeam.members.map(m => (
                              <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'var(--bg-input)', borderRadius: '6px', border: '1px solid var(--line)', fontSize: '11px' }}>
                                <div>
                                  <b style={{ color: 'var(--text-main)' }}>{m.name}</b>
                                  <small style={{ color: 'var(--text-muted)', display: 'block' }}>
                                    {m.memberId} {m.gender ? `· ${m.gender}` : ''}
                                  </small>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span className="badge" style={{
                                    fontSize: '9px',
                                    background: m.status === 'ACCEPTED' ? '#064e3b' : m.status === 'REJECTED' ? '#7f1d1d' : '#78350f',
                                    color: m.status === 'ACCEPTED' ? '#6ee7b7' : m.status === 'REJECTED' ? '#fca5a5' : '#fde68a',
                                  }}>
                                    {m.status}
                                  </span>
                                  {isLeader && m.userId !== user.id && (
                                    <button type="button" onClick={() => handleRemoveTeamMember(userTeam.id, m.userId)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px' }} title="Remove member">
                                      ✕
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Team Rules Live Checklist */}
                          <div style={{ padding: '8px 10px', background: 'var(--bg-card)', borderRadius: '6px', fontSize: '11px', margin: '10px 0' }}>
                            <div style={{ color: satisfiesMinTeam ? '#10b981' : '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>{satisfiesMinTeam ? '✓' : '○'}</span>
                              <span>Minimum {event.minTeamSize} accepted members: <b>{acceptedMembersCount} / {event.minTeamSize}</b></span>
                            </div>
                            {ruleRequiresFemale && (
                              <div style={{ color: hasFemaleMember ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                <span>{hasFemaleMember ? '✓' : '○'}</span>
                                <span>Gender Rule: {hasFemaleMember ? 'Female participant included' : 'Requires at least 1 female team member'}</span>
                              </div>
                            )}
                          </div>

                          {!isLeader && (
                            <p style={{ margin: '8px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                              Your team leader ({userTeam.members.find(m => m.userId === userTeam.leaderId)?.name || 'Leader'}) will submit the final registration pass.
                            </p>
                          )}
                        </div>
                      ) : (
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                            Team Name *
                          </label>
                          <input
                            placeholder="e.g. CyberVanguard"
                            value={teamNameInput}
                            onChange={e => setTeamNameInput(e.target.value)}
                            style={{ width: '100%', height: '36px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text-main)', padding: '0 10px', fontSize: '12px' }}
                          />

                          <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', margin: '10px 0 4px' }}>
                            Invite Team Members by Member ID
                          </label>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <input
                              placeholder="e.g. CSC2026M02 or Roll No"
                              value={memberLookupInput}
                              onChange={e => setMemberLookupInput(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleLookupMember() } }}
                              style={{ flex: 1, height: '36px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text-main)', padding: '0 10px', fontSize: '12px' }}
                            />
                            <button
                              type="button"
                              className="outline"
                              onClick={handleLookupMember}
                              disabled={lookupLoading}
                              style={{ height: '36px', padding: '0 12px', fontSize: '11px' }}
                            >
                              {lookupLoading ? '...' : '＋ ADD'}
                            </button>
                          </div>
                          {lookupError && <small style={{ color: '#fca5a5', display: 'block', marginTop: '4px', fontSize: '11px' }}>{lookupError}</small>}

                          {draftMembers.length > 0 && (
                            <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <b style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Members to Invite:</b>
                              {draftMembers.map(m => (
                                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--bg-input)', borderRadius: '6px', fontSize: '11px' }}>
                                  <span><b>{m.name}</b> ({m.memberId}) · {m.gender}</span>
                                  <button type="button" onClick={() => removeDraftMember(m.id)} style={{ color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer' }}>✕</button>
                                </div>
                              ))}
                            </div>
                          )}

                          <button
                            type="button"
                            className="primary"
                            disabled={teamSubmitting || !teamNameInput.trim()}
                            onClick={handleCreateTeam}
                            style={{ width: '100%', height: '36px', marginTop: '12px', fontSize: '11px' }}
                          >
                            {teamSubmitting ? 'CREATING SQUAD…' : 'CREATE TEAM & SEND INVITES'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Main Event Registration Form - Sequential Step Flow */}
                  <form onSubmit={handleRegister}>
                    <div className="event-registration-steps">

                      {/* ============================================================ */}
                      {/* STEP 1: REGISTRATION FORM (DISPLAYED FIRST)                   */}
                      {/* ============================================================ */}
                      <div className="registration-step-card active">
                        <div className="step-card-header">
                          <h4 className="step-title">
                            <span>📝</span> 1. REGISTRATION FORM
                          </h4>
                          <span className="step-badge">STEP 1</span>
                        </div>

                        {/* If an external form URL (e.g. Google Form) was provided in description/notes */}
                        {formUrl ? (
                          <div className="form-callout-box">
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                              <div>
                                <b style={{ color: 'var(--text-main)', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {isGoogleForm ? 'Google Form Registration' : 'Official Event Registration Form'}
                                </b>
                                <small style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block', marginTop: '2px' }}>
                                  Please fill out and submit the official form before confirming pass generation.
                                </small>
                              </div>
                              <span className="badge badge-president" style={{ fontSize: '9px' }}>REQUIRED</span>
                            </div>

                            {/* Direct Action Button to Open Form */}
                            <a
                              href={formUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="form-open-btn"
                              onClick={() => {
                                setMessage('Form opened in a new tab! Once submitted, tick the confirmation checkbox below.')
                              }}
                            >
                              <span>👉</span> OPEN {isGoogleForm ? 'GOOGLE FORM' : 'REGISTRATION FORM'} ↗
                            </a>

                            {/* Secondary Actions: Embed Toggle & Copy Link */}
                            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                              <button
                                type="button"
                                className="outline"
                                onClick={() => setShowEmbedForm(prev => !prev)}
                                style={{ flex: 1, padding: '6px 10px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                              >
                                {showEmbedForm ? '▲ Hide Inline Form' : '▼ Fill / Preview Form Inline'}
                              </button>
                              <button
                                type="button"
                                className="outline"
                                onClick={() => {
                                  navigator.clipboard?.writeText(formUrl)
                                  setCopiedFormUrl(true)
                                  setTimeout(() => setCopiedFormUrl(false), 2000)
                                }}
                                style={{ padding: '6px 10px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                title="Copy Form URL"
                              >
                                {copiedFormUrl ? '✓ Copied' : '📋 Copy Link'}
                              </button>
                            </div>

                            {/* Embedded iframe if student prefers to fill right on the page */}
                            {showEmbedForm && (
                              <div className="form-embed-container">
                                <iframe
                                  src={embeddableFormUrl}
                                  title="Event Registration Form"
                                  loading="lazy"
                                />
                              </div>
                            )}

                            {/* Mandatory Form Submission Checkbox */}
                            <label className="form-ack-checkbox" style={{
                              background: formAcknowledged ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-card)',
                              border: formAcknowledged ? '1px solid #10b98166' : '1px solid var(--line)',
                            }}>
                              <input
                                type="checkbox"
                                checked={formAcknowledged}
                                onChange={e => setFormAcknowledged(e.target.checked)}
                              />
                              <div>
                                <b style={{ color: formAcknowledged ? '#10b981' : 'var(--text-main)', display: 'block' }}>
                                  {formAcknowledged ? '✓ I have submitted the registration form' : 'I confirm I have submitted the official registration form'}
                                </b>
                                <small style={{ color: 'var(--text-muted)', fontSize: '10.5px' }}>
                                  Check this box after completing and submitting the Google Form above.
                                </small>
                              </div>
                            </label>
                          </div>
                        ) : null}

                        {/* Custom Event Fields (if configured on event) */}
                        {event.formFields && event.formFields.length > 0 && (
                          <div style={{ marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <b style={{ color: 'var(--text-main)', fontSize: '11.5px' }}>ADDITIONAL REGISTRATION QUESTIONS:</b>
                            {event.formFields.map(ff => (
                              <div key={ff.id}>
                                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                                  {ff.fieldName} {ff.isRequired ? '*' : '(Optional)'}
                                </label>
                                {ff.fieldType === 'select' && ff.options ? (
                                  <select
                                    className="member-select"
                                    required={ff.isRequired}
                                    value={customFormAnswers[ff.fieldName] || ''}
                                    onChange={e => setCustomFormAnswers(prev => ({ ...prev, [ff.fieldName]: e.target.value }))}
                                  >
                                    <option value="">Select an option</option>
                                    {ff.options.split(',').map((opt, i) => (
                                      <option key={i} value={opt.trim()}>{opt.trim()}</option>
                                    ))}
                                  </select>
                                ) : ff.fieldType === 'textarea' ? (
                                  <textarea
                                    rows={2}
                                    required={ff.isRequired}
                                    value={customFormAnswers[ff.fieldName] || ''}
                                    onChange={e => setCustomFormAnswers(prev => ({ ...prev, [ff.fieldName]: e.target.value }))}
                                    style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text-main)', padding: '6px 10px', fontSize: '12px' }}
                                  />
                                ) : (
                                  <input
                                    type={ff.fieldType || 'text'}
                                    required={ff.isRequired}
                                    value={customFormAnswers[ff.fieldName] || ''}
                                    onChange={e => setCustomFormAnswers(prev => ({ ...prev, [ff.fieldName]: e.target.value }))}
                                    style={{ width: '100%', height: '36px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text-main)', padding: '0 10px', fontSize: '12px' }}
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Attendee Identity & Hackathon Details Grid (Mandatory) */}
                        <div style={{ margin: '14px 0', padding: '14px', background: 'var(--panel-subtle)', borderRadius: '10px', border: '1px solid var(--line)' }}>
                          <b style={{ color: 'var(--brand-primary)', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                            <IconSparkles size={13} /> ATTENDEE & PARTICIPANT DETAILS (REQUIRED)
                          </b>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                            <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              Full Name *
                              <input
                                type="text"
                                required
                                placeholder="Enter your full name"
                                value={fullName}
                                onChange={e => setFullName(e.target.value)}
                                style={{ width: '100%', marginTop: '3px', height: '34px', background: 'var(--bg-input)', border: !fullName.trim() ? '1px solid #ef444466' : '1px solid var(--line)', borderRadius: '6px', color: 'var(--text-main)', padding: '0 10px', fontSize: '12px' }}
                              />
                            </label>

                            <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              Roll Number / Student ID *
                              <input
                                type="text"
                                required
                                placeholder="e.g. 25EU07R0015"
                                value={rollNumber}
                                onChange={e => setRollNumber(e.target.value.toUpperCase())}
                                style={{ width: '100%', marginTop: '3px', height: '34px', background: 'var(--bg-input)', border: !rollNumber.trim() ? '1px solid #ef444466' : '1px solid var(--line)', borderRadius: '6px', color: 'var(--text-main)', padding: '0 10px', fontSize: '12px', fontFamily: 'monospace' }}
                              />
                            </label>

                            <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              Contact Mobile / WhatsApp *
                              <input
                                type="tel"
                                required
                                placeholder="10-digit mobile number"
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                                style={{ width: '100%', marginTop: '3px', height: '34px', background: 'var(--bg-input)', border: (!phone.trim() || phone.replace(/\D/g, '').length < 10) ? '1px solid #ef444466' : '1px solid var(--line)', borderRadius: '6px', color: 'var(--text-main)', padding: '0 10px', fontSize: '12px' }}
                              />
                            </label>

                            <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              Department / Branch *
                              <select
                                value={department}
                                onChange={e => setDepartment(e.target.value)}
                                className="member-select"
                                style={{ width: '100%', marginTop: '3px', height: '34px' }}
                              >
                                <option value="Cyber Security">Cyber Security</option>
                                <option value="Computer Science (CSE)">Computer Science (CSE)</option>
                                <option value="AI & Data Science (AI&DS)">AI & Data Science (AI&DS)</option>
                                <option value="Information Technology (IT)">Information Technology (IT)</option>
                                <option value="Electronics & Comm. (ECE)">Electronics & Comm. (ECE)</option>
                                <option value="Other Engineering">Other Engineering</option>
                              </select>
                            </label>

                            <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              Academic Year *
                              <select
                                value={academicYear}
                                onChange={e => setAcademicYear(Number(e.target.value))}
                                className="member-select"
                                style={{ width: '100%', marginTop: '3px', height: '34px' }}
                              >
                                <option value={1}>1st Year</option>
                                <option value={2}>2nd Year</option>
                                <option value={3}>3rd Year</option>
                                <option value={4}>4th Year</option>
                              </select>
                            </label>

                            <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              College / Institute Name *
                              <input
                                type="text"
                                required
                                placeholder="e.g. Malla Reddy University"
                                value={collegeName}
                                onChange={e => setCollegeName(e.target.value)}
                                style={{ width: '100%', marginTop: '3px', height: '34px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text-main)', padding: '0 10px', fontSize: '12px' }}
                              />
                            </label>

                            <label style={{ fontSize: '11px', color: isHackathonOrTech ? 'var(--brand-primary)' : 'var(--text-muted)', gridColumn: '1 / -1' }}>
                              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span>GitHub Profile URL {isHackathonOrTech ? '*' : '(Optional)'}</span>
                                {isHackathonOrTech && <span className="badge" style={{ fontSize: '9px', background: 'rgba(82, 187, 245, 0.2)', color: 'var(--brand-primary)' }}>REQUIRED FOR HACKATHONS</span>}
                              </span>
                              <input
                                type="url"
                                required={isHackathonOrTech}
                                placeholder="https://github.com/your-username"
                                value={githubUrl}
                                onChange={e => setGithubUrl(e.target.value)}
                                style={{ width: '100%', marginTop: '3px', height: '34px', background: 'var(--bg-input)', border: isHackathonOrTech && !githubUrl.trim() ? '1.5px solid var(--brand-primary)' : '1px solid var(--line)', borderRadius: '6px', color: 'var(--text-main)', padding: '0 10px', fontSize: '12px', fontFamily: 'monospace' }}
                              />
                            </label>

                            {isHackathonOrTech && (
                              <label style={{ fontSize: '11px', color: 'var(--text-muted)', gridColumn: '1 / -1' }}>
                                Project Domain / Technical Track
                                <input
                                  type="text"
                                  placeholder="e.g. Web3, AI/ML, Cyber Defense, Full Stack Web, Cloud Security"
                                  value={projectDomain}
                                  onChange={e => setProjectDomain(e.target.value)}
                                  style={{ width: '100%', marginTop: '3px', height: '34px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text-main)', padding: '0 10px', fontSize: '12px' }}
                                />
                              </label>
                            )}
                          </div>
                        </div>

                        {/* Attendee Logistics & Demographics */}
                        <div>
                          <b style={{ color: 'var(--brand-primary)', fontSize: '11.5px', display: 'block', marginBottom: '8px' }}>
                            ATTENDEE LOGISTICS & EMERGENCY CONTACT
                          </b>

                          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px', marginBottom: '10px' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Gender *</label>
                              <select
                                value={gender}
                                onChange={e => setGender(e.target.value)}
                                className="member-select"
                                style={{ width: '100%', height: '36px', marginTop: 0 }}
                              >
                                <option value="MALE">Male</option>
                                <option value="FEMALE">Female</option>
                                <option value="OTHER">Other</option>
                              </select>
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Age *</label>
                              <input
                                type="number"
                                min="15"
                                max="60"
                                required
                                value={age}
                                onChange={e => setAge(e.target.value)}
                                style={{ width: '100%', height: '36px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text-main)', padding: '0 10px', fontSize: '12px' }}
                              />
                            </div>
                          </div>

                          {/* Residency Selector */}
                          <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                            Residency Type *
                          </label>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                            <button
                              type="button"
                              onClick={() => setResidencyType('DAY_SCHOLAR')}
                              style={{
                                padding: '8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                border: residencyType === 'DAY_SCHOLAR' ? '1px solid var(--brand-primary)' : '1px solid var(--line)',
                                background: residencyType === 'DAY_SCHOLAR' ? 'var(--brand-glow)' : 'var(--bg-input)',
                                color: residencyType === 'DAY_SCHOLAR' ? 'var(--brand-primary)' : 'var(--text-muted)',
                              }}
                            >
                              Day Scholar
                            </button>
                            <button
                              type="button"
                              onClick={() => setResidencyType('HOSTELLER')}
                              style={{
                                padding: '8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                border: residencyType === 'HOSTELLER' ? '1px solid var(--brand-primary)' : '1px solid var(--line)',
                                background: residencyType === 'HOSTELLER' ? 'var(--brand-glow)' : 'var(--bg-input)',
                                color: residencyType === 'HOSTELLER' ? 'var(--brand-primary)' : 'var(--text-muted)',
                              }}
                            >
                              Hosteller
                            </button>
                          </div>

                          {/* If Day Scholar: Commute mode */}
                          {residencyType === 'DAY_SCHOLAR' && (
                            <div style={{ marginBottom: '10px' }}>
                              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                                Daily Commute Mode *
                              </label>
                              <select
                                value={transportMode}
                                onChange={e => setTransportMode(e.target.value)}
                                className="member-select"
                                style={{ width: '100%', height: '36px', marginTop: 0 }}
                              >
                                <option value="COLLEGE_BUS">College Bus</option>
                                <option value="PUBLIC_BUS">Public Bus / RTC</option>
                                <option value="OWN_TRANSPORT">Own Transport / Personal Vehicle</option>
                              </select>
                            </div>
                          )}

                          {/* If Hosteller: Hostel type */}
                          {residencyType === 'HOSTELLER' && (
                            <div style={{ marginBottom: '10px' }}>
                              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                                Hostel Accommodation *
                              </label>
                              <select
                                value={hostelType}
                                onChange={e => setHostelType(e.target.value)}
                                className="member-select"
                                style={{ width: '100%', height: '36px', marginTop: 0 }}
                              >
                                <option value="COLLEGE_HOSTEL">College Campus Hostel</option>
                                <option value="PRIVATE_HOSTEL">Private Hostel / PG</option>
                              </select>
                            </div>
                          )}

                          {/* Emergency Contact */}
                          <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                              Emergency Contact / Parent Mobile Number *
                            </label>
                            <input
                              type="tel"
                              required
                              placeholder="10-digit emergency contact number"
                              value={emergencyContact}
                              onChange={e => setEmergencyContact(e.target.value)}
                              style={{ width: '100%', height: '36px', background: 'var(--bg-input)', border: (!emergencyContact.trim() || emergencyContact.replace(/\D/g, '').length < 10) ? '1px solid #ef444466' : '1px solid var(--line)', borderRadius: '6px', color: 'var(--text-main)', padding: '0 10px', fontSize: '12px' }}
                            />
                          </div>
                        </div>

                        {/* Multi-Track Sub-Activities (if any) */}
                        {event.activities && event.activities.length > 0 && (
                          <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--line)' }}>
                            <b style={{ color: 'var(--brand-primary)', fontSize: '11.5px' }}>Select Optional Track:</b>
                            <div className="activity-selector-list" style={{ marginTop: '8px' }}>
                              {event.activities.map(act => (
                                <div
                                  key={act.id}
                                  className={`activity-option ${selectedActivities.includes(act.id) ? 'selected' : ''}`}
                                  onClick={() => toggleActivity(act.id)}
                                >
                                  <div>
                                    <b>{act.name}</b>
                                    {act.description && <small style={{ display: 'block', color: '#7e95a7' }}>{act.description}</small>}
                                  </div>
                                  <span className="activity-price">{act.price > 0 ? `₹${act.price}` : 'INCLUDED'}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* ============================================================ */}
                      {/* STEP 2: PAYMENT DETAILS & MONEY QR (DISPLAYED SECOND)        */}
                      {/* ============================================================ */}
                      {event.requiresPayment ? (
                        <div className="registration-step-card">
                          <div className="step-card-header">
                            <h4 className="step-title">
                              <span>💳</span> 2. PAYMENT DETAILS & MONEY QR
                            </h4>
                            <span className="step-badge">STEP 2</span>
                          </div>

                          <div className="total-price-badge">
                            <span>Registration Fee:</span>
                            <span>₹{totalPrice.toFixed(2)}</span>
                          </div>

                          {/* Guaranteed High-Visibility Money QR Code */}
                          <div style={{
                            textAlign: 'center',
                            margin: '14px 0',
                            padding: '16px',
                            background: '#ffffff',
                            borderRadius: '12px',
                            border: '2px solid var(--brand-primary)',
                            boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
                          }}>
                            <b style={{ color: '#07121c', fontSize: '12.5px', display: 'block', marginBottom: '8px', letterSpacing: '0.4px', fontWeight: 800 }}>
                              SCAN MONEY QR TO PAY VIA ANY UPI APP
                            </b>
                            <div style={{ display: 'inline-block', padding: '6px', background: '#fff', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                              <img
                                src={event.paymentQrUrl || `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(`upi://pay?pa=${event.paymentUpiId || 'club@upi'}&pn=CyberSecurityClub&am=${totalPrice}&cu=INR`)}`}
                                alt="Money QR Code"
                                style={{ maxWidth: '170px', height: 'auto', display: 'block', margin: '0 auto' }}
                              />
                            </div>
                            {event.paymentUpiId && (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '10px' }}>
                                <span style={{ color: '#07121c', fontSize: '13px', fontWeight: 700, fontFamily: 'monospace' }}>
                                  UPI: {event.paymentUpiId}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard?.writeText(event.paymentUpiId)
                                    setCopiedUpi(true)
                                    setTimeout(() => setCopiedUpi(false), 2000)
                                  }}
                                  style={{ padding: '3px 10px', fontSize: '10.5px', background: 'var(--brand-primary)', color: '#07121c', fontWeight: 700, borderRadius: '4px', border: 'none', cursor: 'pointer' }}
                                >
                                  {copiedUpi ? '✓ COPIED' : '📋 COPY UPI ID'}
                                </button>
                              </div>
                            )}
                            <small style={{ color: '#64748b', fontSize: '11px', display: 'block', marginTop: '6px' }}>
                              Scan via Google Pay, PhonePe, Paytm, BHIM, Cred, or any Banking App
                            </small>
                          </div>

                          {event.paymentInstructions && (
                            <p style={{ margin: '8px 0', padding: '8px 10px', background: 'var(--bg-card)', borderRadius: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                              ℹ️ {event.paymentInstructions}
                            </p>
                          )}

                          <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-main)', fontWeight: 600, marginBottom: '4px', marginTop: '10px' }}>
                            12-Digit UPI Reference / UTR Number *
                          </label>
                          <input
                            required
                            value={paymentReference}
                            onChange={e => setPaymentReference(e.target.value.replace(/\s+/g, ''))}
                            placeholder="e.g. 523412984512 (from PhonePe / GPay / Paytm receipt)"
                            style={{ width: '100%', height: '38px', background: 'var(--bg-input)', border: paymentReference.length >= 10 ? '1.5px solid #10b981' : '1px solid var(--line)', borderRadius: '6px', color: 'var(--text-main)', padding: '0 10px', fontSize: '12.5px', fontFamily: 'monospace', letterSpacing: '1px' }}
                          />
                          <small style={{ display: 'block', marginTop: '4px', color: '#10b981', fontSize: '10.5px', fontWeight: 600 }}>
                            ⚡ Auto-Accepted: Your registration and payment are verified instantly upon submission. No waiting for re-verification!
                          </small>
                        </div>
                      ) : (
                        <div className="registration-step-card" style={{ padding: '12px 14px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid #10b98144' }}>
                          <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            ✓ FREE EVENT · NO PAYMENT REQUIRED
                          </span>
                        </div>
                      )}

                      {/* ============================================================ */}
                      {/* STEP 3: REGISTER BUTTON (DISPLAYED THIRD / LAST)             */}
                      {/* ============================================================ */}
                      <div className="registration-step-card">
                        <div className="step-card-header">
                          <h4 className="step-title">
                            <span>🎟️</span> {event.requiresPayment ? '3.' : '2.'} CONFIRM & GET PASS
                          </h4>
                          <span className="step-badge">{event.requiresPayment ? 'STEP 3' : 'FINAL STEP'}</span>
                        </div>

                        {/* Step checklist overview */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11.5px', marginBottom: '12px', padding: '8px 10px', background: 'var(--bg-card)', borderRadius: '6px' }}>
                          <span style={{ color: !formUrl || formAcknowledged ? '#10b981' : '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {!formUrl || formAcknowledged ? '✓' : '○'} Registration Form: {!formUrl ? 'Ready' : formAcknowledged ? 'Completed & Confirmed' : 'Complete Step 1 Above'}
                          </span>
                          <span style={{ color: fullName.trim() && rollNumber.trim() && phone.trim() && department.trim() && (!isHackathonOrTech || githubUrl.trim()) ? '#10b981' : '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {fullName.trim() && rollNumber.trim() && phone.trim() && department.trim() && (!isHackathonOrTech || githubUrl.trim()) ? '✓' : '○'} Attendee Details: {fullName.trim() && rollNumber.trim() && phone.trim() && department.trim() && (!isHackathonOrTech || githubUrl.trim()) ? 'All Required Details Filled' : 'Fill Required Fields in Step 1'}
                          </span>
                          {event.requiresPayment && (
                            <span style={{ color: paymentReference.trim() ? '#10b981' : '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {paymentReference.trim() ? '✓' : '○'} Payment: {paymentReference.trim() ? 'UTR Reference Entered' : 'Enter 12-Digit UTR in Step 2'}
                            </span>
                          )}
                          {event.isTeamEvent && (
                            <span style={{ color: satisfiesMinTeam ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {satisfiesMinTeam ? '✓' : '○'} Team Squad: {satisfiesMinTeam ? `${acceptedMembersCount} members accepted` : `Requires ${event.minTeamSize} members`}
                            </span>
                          )}
                        </div>

                        <button
                          className="primary"
                          type="submit"
                          disabled={
                            submitting ||
                            (event.isTeamEvent && !isLeader) ||
                            (formUrl && !formAcknowledged) ||
                            !fullName.trim() ||
                            !rollNumber.trim() ||
                            !phone.trim() ||
                            !department.trim() ||
                            (isHackathonOrTech && !githubUrl.trim()) ||
                            (!emergencyContact.trim() || emergencyContact.replace(/\D/g, '').length < 10) ||
                            (event.requiresPayment && !paymentReference.trim())
                          }
                          style={{
                            width: '100%',
                            minHeight: '46px',
                            fontSize: '12.5px',
                            fontWeight: 800,
                            letterSpacing: '0.04em',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                          }}
                        >
                          {submitting
                            ? 'CONFIRMING PASS…'
                            : event.isTeamEvent
                            ? 'CONFIRM & ISSUE TEAM PASSES ➔'
                            : 'CONFIRM REGISTRATION & GET EVENT PASS ➔'}
                        </button>
                      </div>

                    </div>
                  </form>
                </div>
              )}
            </article>
          </div>
        </div>
      </section>
    </LivePortal>
  )
}

// ----------------------------------------------------
// Admin Passes & Gate Attendance Management
// ----------------------------------------------------
function PaymentManagement({ user, logout, onNavigate }) {
  const [passes, setPasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Filter States
  const [searchQuery, setSearchQuery] = useState('')
  const [eventFilter, setEventFilter] = useState('ALL')
  const [paymentFilter, setPaymentFilter] = useState('ALL')
  const [attendanceFilter, setAttendanceFilter] = useState('ALL')
  const [modeFilter, setModeFilter] = useState('ALL')

  // Selected Pass for Full Detail Modal
  const [selectedPass, setSelectedPass] = useState(null)

  function loadPasses() {
    let mounted = true
    setLoading(true)
    Promise.all([
      adminApi.listAllPasses({
        eventId: eventFilter,
        paymentStatus: paymentFilter,
        attendanceStatus: attendanceFilter,
      }),
      adminApi.listEvents().catch(() => ({ events: [] })),
    ])
      .then(([passRes, evRes]) => {
        if (!mounted) return
        setPasses(passRes.passes || [])
        setEvents(evRes.events || [])
      })
      .catch(err => { if (mounted) setError(err.message) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }

  useEffect(() => {
    return loadPasses()
  }, [eventFilter, paymentFilter, attendanceFilter])

  async function handleVerifyUTR(passId) {
    setError('')
    setMessage('')
    try {
      await adminApi.verifyPassPayment(passId)
      setPasses(c => c.map(p => (p.id === passId ? { ...p, paymentStatus: 'VERIFIED', status: 'REGISTERED' } : p)))
      setMessage('Payment verified! Digital pass activated.')
    } catch (err) {
      setError(err.message || 'Failed to verify payment.')
    }
  }

  async function handleGrantGateEntry(regId) {
    setError('')
    setMessage('')
    try {
      await adminApi.grantEventEntry(regId)
      setPasses(c => c.map(p => (p.id === regId ? { ...p, attendanceMarked: true, attendedAt: new Date().toISOString() } : p)))
      setMessage('Attendee admitted and attendance recorded.')
    } catch (err) {
      setError(err.message || 'Failed to record attendance.')
    }
  }

  const filteredPasses = passes.filter(p => {
    if (modeFilter === 'TEAM' && !p.isTeamEvent && !p.teamName) return false
    if (modeFilter === 'INDIVIDUAL' && (p.isTeamEvent || p.teamName)) return false

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      const match =
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.memberId && p.memberId.toLowerCase().includes(q)) ||
        (p.rollNumber && p.rollNumber.toLowerCase().includes(q)) ||
        (p.id && p.id.toLowerCase().includes(q)) ||
        (p.eventTitle && p.eventTitle.toLowerCase().includes(q)) ||
        (p.teamName && p.teamName.toLowerCase().includes(q)) ||
        (p.paymentReference && p.paymentReference.toLowerCase().includes(q))
      if (!match) return false
    }
    return true
  })

  function handleDownloadPassesCsv() {
    const headers = [
      'Pass ID',
      'Student Name',
      'Member ID',
      'College / Institution',
      'Department / Branch',
      'Academic Year',
      'College Roll Number',
      'Gender',
      'Age',
      'Official Email',
      'Phone Number',
      'Emergency Contact',
      'Residency Type',
      'Commute / Hostel Mode',
      'Event Title',
      'Event Date',
      'Participation Mode',
      'Team Name',
      'Team Leader',
      'Registration Fee (₹)',
      'Payment Status',
      'UPI UTR Reference',
      'Attendance Marked',
      'Check-in Timestamp',
      'Registered At',
    ]
    const rows = filteredPasses.map(p => [
      p.id,
      p.name || p.memberName || p.user?.profile?.name || p.memberId,
      p.memberId || p.user?.memberId,
      p.department || p.user?.profile?.department,
      p.department || p.user?.profile?.department,
      p.year || p.user?.profile?.year,
      p.rollNumber || p.user?.profile?.rollNumber,
      p.gender || p.user?.profile?.gender || 'UNSPECIFIED',
      p.age || p.user?.profile?.age || null,
      p.email || p.user?.profile?.email,
      p.phone || p.user?.profile?.phone,
      p.emergencyContact,
      p.residencyType,
      p.residencyType === 'HOSTELLER' ? p.hostelType : p.transportMode,
      p.eventTitle,
      p.eventDate ? new Date(p.eventDate).toLocaleDateString() : null,
      p.teamName ? 'Team' : 'Individual',
      p.teamName || 'N/A',
      p.isTeamLeader ? 'Yes' : 'No',
      p.totalAmount,
      p.paymentStatus,
      p.paymentReference || 'N/A',
      p.attendanceMarked ? 'Yes' : 'No',
      p.attendedAt ? new Date(p.attendedAt).toLocaleString() : 'N/A',
      p.registeredAt ? new Date(p.registeredAt).toLocaleString() : null,
    ])
    downloadCsv('event_passes_roster.csv', headers, rows)
  }

  return (
    <LivePortal user={user} logout={logout} activeTab="admin-payments" onNavigate={onNavigate} title="EVENT PASSES & GATE ROSTER">
      <section className="member-management">
        <div className="member-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate('admin-dashboard')}>
              ← COMMAND CENTER
            </button>
            <p className="eyebrow">ATTENDEE ROSTER & PASS VERIFICATION</p>
            <h1>Event Passes & Attendee Roster</h1>
            <p>Inspect student passes, verify UPI UTR transactions, check residency & commute logistics, and track gate attendance.</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="primary"
              onClick={() => onNavigate('admin-qr-scanner')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '6px 14px' }}
            >
              <Icon8 name="irisScan" size={16} /> GATE QR SCANNER
            </button>
            <button
              type="button"
              className="outline"
              onClick={handleDownloadPassesCsv}
              disabled={filteredPasses.length === 0}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '6px 12px' }}
              title="Download event passes as CSV"
            >
              <IconDownload size={14} /> DOWNLOAD PASSES CSV
            </button>
          </div>
        </div>

        {message && <p className="member-form-success">{message}</p>}
        {error && <p className="member-form-error">{error}</p>}

        {/* Premium KPI Metrics HUD */}
        <div className="roster-stats-hud">
          <div className="roster-stat-card">
            <span className="roster-stat-label">TOTAL ISSUED PASSES</span>
            <span className="roster-stat-value" style={{ color: 'var(--brand-primary)' }}>{passes.length}</span>
            <small style={{ color: 'var(--text-dim)', fontSize: '10px' }}>Active Access Tokens</small>
          </div>
          <div className="roster-stat-card">
            <span className="roster-stat-label">VERIFIED / PAID</span>
            <span className="roster-stat-value" style={{ color: '#10b981' }}>
              {passes.filter(p => p.paymentStatus === 'PAID' || p.paymentStatus === 'VERIFIED' || p.isFree).length}
            </span>
            <small style={{ color: 'var(--text-dim)', fontSize: '10px' }}>Confirmed Attendees</small>
          </div>
          <div className="roster-stat-card">
            <span className="roster-stat-label">PENDING UTR APPROVAL</span>
            <span className="roster-stat-value" style={{ color: '#f59e0b' }}>
              {passes.filter(p => p.paymentStatus === 'PENDING').length}
            </span>
            <small style={{ color: 'var(--text-dim)', fontSize: '10px' }}>Requires Review</small>
          </div>
          <div className="roster-stat-card">
            <span className="roster-stat-label">VERIFIED PASS REVENUE</span>
            <span className="roster-stat-value" style={{ color: '#10b981' }}>
              ₹{passes.reduce((sum, p) => sum + ((p.paymentStatus === 'PAID' || p.paymentStatus === 'VERIFIED') ? (Number(p.totalAmount) || 0) : 0), 0)}
            </span>
            <small style={{ color: 'var(--text-dim)', fontSize: '10px' }}>Direct UPI Inflow</small>
          </div>
          <div className="roster-stat-card">
            <span className="roster-stat-label">GATE CHECK-INS</span>
            <span className="roster-stat-value" style={{ color: 'var(--text-main)' }}>
              {passes.filter(p => p.attendanceMarked).length}
            </span>
            <small style={{ color: 'var(--text-dim)', fontSize: '10px' }}>Admitted Into Venues</small>
          </div>
        </div>

        {/* Search & Filter Command Strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', margin: '16px 0', alignItems: 'center' }}>
          <div>
            <input
              placeholder="Search student, member ID, pass, UTR, team..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '100%', height: '40px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)', padding: '0 12px', fontSize: '12px' }}
            />
          </div>
          <div>
            <select
              value={eventFilter}
              onChange={e => setEventFilter(e.target.value)}
              className="member-select"
              style={{ width: '100%', height: '40px', marginTop: 0 }}
            >
              <option value="ALL">All Events ({events.length})</option>
              {events.map(ev => (
                <option key={ev.id} value={ev.id}>{ev.title}</option>
              ))}
            </select>
          </div>
          <div>
            <select
              value={paymentFilter}
              onChange={e => setPaymentFilter(e.target.value)}
              className="member-select"
              style={{ width: '100%', height: '40px', marginTop: 0 }}
            >
              <option value="ALL">All Payments</option>
              <option value="PAID">Verified / Paid</option>
              <option value="PENDING">Pending UTR</option>
              <option value="FREE">Free Passes</option>
            </select>
          </div>
          <div>
            <select
              value={attendanceFilter}
              onChange={e => setAttendanceFilter(e.target.value)}
              className="member-select"
              style={{ width: '100%', height: '40px', marginTop: 0 }}
            >
              <option value="ALL">All Attendance</option>
              <option value="ATTENDED">Admitted / Present</option>
              <option value="ABSENT">Not Yet Admitted</option>
            </select>
          </div>
          <div>
            <select
              value={modeFilter}
              onChange={e => setModeFilter(e.target.value)}
              className="member-select"
              style={{ width: '100%', height: '40px', marginTop: 0 }}
            >
              <option value="ALL">All Modes</option>
              <option value="INDIVIDUAL">Individual</option>
              <option value="TEAM">Teams</option>
            </select>
          </div>
        </div>

        {/* Pass Roster Table */}
        <article className="member-list-card">
          {loading ? (
            <p className="directory-state">Loading passes & attendee records...</p>
          ) : filteredPasses.length === 0 ? (
            <p className="directory-state">No matching passes found.</p>
          ) : (
            <div className="table-scroll-container">
              <div className="sub-table">
                <div className="sub-table-header" style={{ gridTemplateColumns: '1.4fr 1.3fr 1.1fr 1.2fr 1fr 1fr' }}>
                  <span>STUDENT & DEMOGRAPHICS</span>
                  <span>EVENT & TEAM</span>
                  <span>RESIDENCY / COMMUTE</span>
                  <span>PAYMENT & UTR</span>
                  <span>GATE ENTRY</span>
                  <span>ACTIONS</span>
                </div>
                {filteredPasses.map(p => (
                  <div className="sub-table-row" key={p.id} style={{ gridTemplateColumns: '1.4fr 1.3fr 1.1fr 1.2fr 1fr 1fr', alignItems: 'center' }}>
                    {/* Student Info */}
                    <div>
                      <b style={{ color: 'var(--text-main)', fontSize: '13px' }}>{p.name}</b>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                        <small style={{ color: 'var(--brand-primary)', fontFamily: 'monospace' }}>{p.memberId}</small>
                        <span className="badge" style={{ fontSize: '9px', padding: '1px 6px', background: 'var(--panel-subtle)', color: 'var(--text-muted)' }}>
                          {p.gender} {p.age ? `· ${p.age}y` : ''}
                        </span>
                      </div>
                      <small style={{ color: 'var(--text-dim)', display: 'block' }}>{p.department} {p.year ? `· Y${p.year}` : ''}</small>
                    </div>

                    {/* Event & Team */}
                    <div>
                      <b style={{ color: 'var(--text-main)', fontSize: '12px' }}>{p.eventTitle}</b>
                      {p.teamName ? (
                        <span className="badge" style={{ display: 'inline-block', marginTop: '4px', fontSize: '10px', background: p.isTeamLeader ? 'var(--brand-glow)' : 'var(--panel-subtle)', color: p.isTeamLeader ? 'var(--brand-primary)' : 'var(--text-main)', border: '1px solid var(--line)' }}>
                          {p.teamName} {p.isTeamLeader ? '(Leader)' : '(Member)'}
                        </span>
                      ) : (
                        <small style={{ color: 'var(--text-muted)', display: 'block' }}>Individual Participant</small>
                      )}
                    </div>

                    {/* Residency & Commute */}
                    <div>
                      <b style={{ color: 'var(--text-main)', fontSize: '11px', display: 'block' }}>
                        {p.residencyType === 'HOSTELLER' ? 'Hosteller' : 'Day Scholar'}
                      </b>
                      <small style={{ color: 'var(--brand-primary)', display: 'block' }}>
                        {p.residencyType === 'HOSTELLER'
                          ? (p.hostelType === 'PRIVATE_HOSTEL' ? 'Private PG' : 'College Hostel')
                          : (p.transportMode === 'COLLEGE_BUS' ? 'College Bus' : p.transportMode === 'PUBLIC_BUS' ? 'Public Bus' : 'Own Transport')}
                      </small>
                    </div>

                    {/* Payment & UTR */}
                    <div>
                      <strong style={{ color: '#70ddb4', fontSize: '13px' }}>
                        {p.totalAmount > 0 ? `₹${p.totalAmount}` : 'Free Entry'}
                      </strong>
                      {p.paymentReference && (
                        <small style={{ color: 'var(--text-dim)', display: 'block', fontFamily: 'monospace' }}>
                          UTR: {p.paymentReference}
                        </small>
                      )}
                      <span className={`badge badge-${(p.paymentStatus || 'free').toLowerCase()}`} style={{ marginTop: '3px', display: 'inline-block', fontSize: '9px' }}>
                        {p.paymentStatus}
                      </span>
                    </div>

                    {/* Gate Attendance */}
                    <div>
                      {p.attendanceMarked ? (
                        <span className="badge" style={{ background: '#064e3b', color: '#6ee7b7', border: '1px solid #10b981', fontSize: '10px' }}>
                          ✓ PRESENT
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="action-btn"
                          onClick={() => handleGrantGateEntry(p.id)}
                          style={{ fontSize: '10px', padding: '4px 8px', background: 'var(--panel-subtle)', color: 'var(--text-main)', border: '1px solid var(--line)' }}
                        >
                          Check-in
                        </button>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="action-buttons" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {p.paymentStatus === 'SUBMITTED' && (
                        <button className="action-btn save-btn" onClick={() => handleVerifyUTR(p.id)} style={{ fontSize: '10px', padding: '4px 8px' }}>
                          Verify UTR
                        </button>
                      )}
                      <button className="action-btn" onClick={() => setSelectedPass(p)} style={{ fontSize: '10px', padding: '4px 8px', background: 'var(--brand-glow)', color: 'var(--brand-primary)', border: '1px solid var(--line)' }}>
                        Pass QR
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </article>

        {/* Selected Pass Details & QR Modal */}
        {selectedPass && (
          <div className="photo-lightbox" onClick={() => setSelectedPass(null)}>
            <div className="photo-lightbox-content" onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-modal)', padding: '28px', borderRadius: '16px', border: '1px solid var(--line)', maxWidth: '620px', width: '95vw', maxHeight: '88vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span className="badge badge-president">{selectedPass.eventType || 'EVENT PASS'}</span>
                <button className="lightbox-close" onClick={() => setSelectedPass(null)} style={{ position: 'static' }}>✕</button>
              </div>

              {selectedPass.qrCodeData && (
                <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                  <div style={{ background: '#fff', padding: '12px', borderRadius: '12px', display: 'inline-block' }}>
                    <img src={selectedPass.qrCodeData} alt="Pass QR" style={{ width: '150px', height: '150px', imageRendering: 'pixelated' }} />
                  </div>
                </div>
              )}

              <h2 style={{ font: '700 20px Syne', color: 'var(--text-main)', margin: '0 0 4px', textAlign: 'center' }}>
                {selectedPass.name || selectedPass.memberName || selectedPass.user?.profile?.name || selectedPass.memberId}
              </h2>
              <p style={{ color: 'var(--brand-primary)', fontFamily: 'monospace', fontSize: '12px', margin: '0 0 16px', textAlign: 'center' }}>
                PASS ID: {selectedPass.id} · MEMBER: {selectedPass.memberId || selectedPass.user?.memberId}
              </p>

              <div style={{ background: 'var(--panel-subtle)', borderRadius: '12px', padding: '16px', fontSize: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', color: 'var(--text-muted)', border: '1px solid var(--line)' }}>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>COLLEGE / INSTITUTION</span>
                  <b style={{ color: 'var(--text-main)', display: 'block', marginTop: '2px' }}>
                    {selectedPass.department || selectedPass.user?.profile?.department || 'Malla Reddy (MR) Deemed to be University'}
                  </b>
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ACADEMIC YEAR & ROLL</span>
                  <b style={{ color: 'var(--text-main)', display: 'block', marginTop: '2px' }}>
                    Year {selectedPass.year || selectedPass.user?.profile?.year || '1'} · Roll: {selectedPass.rollNumber || selectedPass.user?.profile?.rollNumber || '---'}
                  </b>
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>EMAIL ADDRESS</span>
                  <b style={{ color: 'var(--text-main)', display: 'block', marginTop: '2px', wordBreak: 'break-all' }}>
                    {selectedPass.email || selectedPass.user?.profile?.email || '---'}
                  </b>
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>PHONE & EMERGENCY</span>
                  <b style={{ color: 'var(--text-main)', display: 'block', marginTop: '2px' }}>
                    {selectedPass.phone || selectedPass.user?.profile?.phone || '---'} {selectedPass.emergencyContact ? `(Emerg: ${selectedPass.emergencyContact})` : ''}
                  </b>
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>GENDER & AGE</span>
                  <b style={{ color: 'var(--text-main)', display: 'block', marginTop: '2px' }}>
                    {selectedPass.gender || selectedPass.user?.profile?.gender || 'MALE'} · {selectedPass.age || selectedPass.user?.profile?.age || '---'} yrs
                  </b>
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>RESIDENCY & COMMUTE</span>
                  <b style={{ color: 'var(--text-main)', display: 'block', marginTop: '2px' }}>
                    {selectedPass.residencyType === 'HOSTELLER'
                      ? (selectedPass.hostelType === 'PRIVATE_HOSTEL' ? 'Private PG / Hostel' : 'College Hostel')
                      : (selectedPass.transportMode === 'COLLEGE_BUS' ? 'College Bus Commuter' : selectedPass.transportMode === 'PUBLIC_BUS' ? 'Public Bus' : 'Day Scholar')}
                  </b>
                </div>
                {selectedPass.teamName && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>TEAM SQUAD</span>
                    <b style={{ color: 'var(--brand-primary)', display: 'block', marginTop: '2px' }}>
                      {selectedPass.teamName} {selectedPass.isTeamLeader ? '★ Squad Leader' : '· Squad Member'}
                    </b>
                  </div>
                )}
                <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--line)', paddingTop: '10px', marginTop: '4px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>PAYMENT & UTR</span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <strong style={{ color: '#70ddb4', fontSize: '14px' }}>
                        {selectedPass.totalAmount > 0 ? `₹${selectedPass.totalAmount}` : 'Free Entry'}
                      </strong>
                      <span className={`badge badge-${(selectedPass.paymentStatus || 'free').toLowerCase()}`} style={{ marginLeft: '8px' }}>
                        {selectedPass.paymentStatus}
                      </span>
                      {selectedPass.paymentReference && (
                        <span style={{ display: 'block', color: 'var(--brand-primary)', fontFamily: 'monospace', fontSize: '11px', marginTop: '2px' }}>
                          UTR: {selectedPass.paymentReference}
                        </span>
                      )}
                    </div>
                    {selectedPass.paymentProofUrl && (
                      <a
                        href={selectedPass.paymentProofUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="action-btn"
                        style={{ fontSize: '10px', padding: '4px 10px', background: 'var(--panel-elevated)', color: 'var(--brand-primary)', border: '1px solid var(--line)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        VIEW PAYMENT PROOF ↗
                      </a>
                    )}
                  </div>
                </div>

                {/* Custom Form Data (if any) */}
                {selectedPass.formData && typeof selectedPass.formData === 'object' && Object.keys(selectedPass.formData).length > 0 && (
                  <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--line)', paddingTop: '10px', marginTop: '4px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>CUSTOM FORM RESPONSES</span>
                    <div style={{ marginTop: '6px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      {Object.entries(selectedPass.formData).map(([k, v]) => (
                        <div key={k} style={{ background: 'var(--bg-input)', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--line)' }}>
                          <small style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10px' }}>{k}</small>
                          <span style={{ color: 'var(--text-main)', fontSize: '11px', fontWeight: 600 }}>{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ marginTop: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {(selectedPass.paymentStatus === 'SUBMITTED' || selectedPass.paymentStatus === 'PENDING') && selectedPass.totalAmount > 0 && (
                  <button
                    type="button"
                    className="primary"
                    onClick={() => { handleVerifyUTR(selectedPass.id); setSelectedPass(null) }}
                    style={{ flex: 1, height: '38px', fontSize: '11px' }}
                  >
                    VERIFY UTR & ACTIVATE
                  </button>
                )}
                {!selectedPass.attendanceMarked && (
                  <button
                    type="button"
                    className="action-btn save-btn"
                    onClick={() => { handleGrantGateEntry(selectedPass.id); setSelectedPass(null) }}
                    style={{ flex: 1, height: '38px', fontSize: '11px' }}
                  >
                    RECORD GATE ENTRY
                  </button>
                )}
                <button
                  type="button"
                  className="action-btn"
                  onClick={() => setSelectedPass(null)}
                  style={{ height: '38px', padding: '0 16px', background: 'var(--panel-elevated)', color: 'var(--text-main)', border: '1px solid var(--line)', fontSize: '11px' }}
                >
                  CLOSE
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </LivePortal>
  )
}

// ----------------------------------------------------
// Interactive Photo Lightbox with Prev/Next Navigation
// ----------------------------------------------------
function GalleryLightbox({ photos = [], activePhoto, onClose, onSelectPhoto, onDeletePhoto, albumName }) {
  const [currentIndex, setCurrentIndex] = useState(() => {
    const idx = photos.findIndex(p => p.id === activePhoto?.id)
    return idx >= 0 ? idx : 0
  })

  useEffect(() => {
    if (activePhoto) {
      const idx = photos.findIndex(p => p.id === activePhoto.id)
      if (idx >= 0) setCurrentIndex(idx)
    }
  }, [activePhoto, photos])

  const currentPhoto = photos[currentIndex] || activePhoto
  const totalCount = photos.length || (currentPhoto ? 1 : 0)

  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < photos.length - 1

  function handlePrev(e) {
    if (e) e.stopPropagation()
    if (hasPrev) {
      const nextIdx = currentIndex - 1
      setCurrentIndex(nextIdx)
      if (onSelectPhoto && photos[nextIdx]) onSelectPhoto(photos[nextIdx])
    }
  }

  function handleNext(e) {
    if (e) e.stopPropagation()
    if (hasNext) {
      const nextIdx = currentIndex + 1
      setCurrentIndex(nextIdx)
      if (onSelectPhoto && photos[nextIdx]) onSelectPhoto(photos[nextIdx])
    }
  }

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'ArrowLeft') handlePrev()
      else if (e.key === 'ArrowRight') handleNext()
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentIndex, photos, hasPrev, hasNext])

  if (!currentPhoto) return null

  return (
    <div className="photo-lightbox" onClick={onClose}>
      <div className="photo-lightbox-content" onClick={e => e.stopPropagation()}>
        {/* Header Bar */}
        <div className="lightbox-header-bar">
          <span className="lightbox-counter-badge">
            PHOTO {totalCount > 0 ? currentIndex + 1 : 1} OF {totalCount}
          </span>
          <button className="lightbox-close" onClick={onClose} title="Close (Esc)">✕</button>
        </div>

        {/* Main Photo Area with Left/Right Navigation Buttons */}
        <div className="photo-lightbox-main">
          {photos.length > 1 && (
            <button
              type="button"
              className="lightbox-nav-btn prev"
              onClick={handlePrev}
              disabled={!hasPrev}
              title="Previous Photo (← Left Arrow)"
            >
              ‹
            </button>
          )}

          <img src={currentPhoto.imageUrl} alt={currentPhoto.caption || albumName || 'Gallery Photo'} />

          {photos.length > 1 && (
            <button
              type="button"
              className="lightbox-nav-btn next"
              onClick={handleNext}
              disabled={!hasNext}
              title="Next Photo (→ Right Arrow)"
            >
              ›
            </button>
          )}
        </div>

        {/* Caption, Date & Admin Actions */}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', padding: '0 6px' }}>
          <div>
            <p style={{ color: 'var(--text-main)', margin: 0, fontSize: '13px', fontWeight: 600 }}>
              {currentPhoto.caption || albumName || 'Club Gallery Photo'}
            </p>
            <small style={{ color: 'var(--brand-primary)', fontSize: '10px' }}>
              {currentPhoto.createdAt ? new Date(currentPhoto.createdAt).toLocaleDateString() : ''}
            </small>
          </div>

          {onDeletePhoto && (
            <button
              type="button"
              className="action-btn delete-btn"
              onClick={e => onDeletePhoto(currentPhoto.id, e)}
              style={{ padding: '5px 12px', fontSize: '11px' }}
            >
              Delete Photo
            </button>
          )}
        </div>

        {/* Miniature Thumbnails Strip */}
        {photos.length > 1 && (
          <div className="lightbox-thumbnail-strip">
            {photos.map((p, idx) => (
              <div
                key={p.id}
                className={`lightbox-thumb ${idx === currentIndex ? 'active' : ''}`}
                onClick={() => {
                  setCurrentIndex(idx)
                  if (onSelectPhoto) onSelectPhoto(p)
                }}
                title={p.caption || `Photo ${idx + 1}`}
              >
                <img src={p.imageUrl} alt={`Thumbnail ${idx + 1}`} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ----------------------------------------------------
// Gallery Studio (Admin)
// ----------------------------------------------------
function GalleryManagement({ user, logout, onNavigate }) {
  const [albums, setAlbums] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [selectedAlbum, setSelectedAlbum] = useState(null)
  const [albumCoverPreview, setAlbumCoverPreview] = useState('')
  const [stagedPhotos, setStagedPhotos] = useState([])
  const [batchCaption, setBatchCaption] = useState('')
  const [uploading, setUploading] = useState(false)
  const [activeLightbox, setActiveLightbox] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    let mounted = true
    adminApi.listGalleryAlbums()
      .then(({ albums: list }) => { if (mounted) setAlbums(list || []) })
      .catch(err => { if (mounted) setError(err.message) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  const [albumName, setAlbumName] = useState('')
  const [albumDescription, setAlbumDescription] = useState('')
  const [creatingAlbum, setCreatingAlbum] = useState(false)
  const coverInputRef = useRef(null)

  useEffect(() => {
    let mounted = true
    adminApi.listGalleryAlbums()
      .then(({ albums: list }) => { if (mounted) setAlbums(list || []) })
      .catch(err => { if (mounted) setError(err.message) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  async function createAlbum(e) {
    e.preventDefault()
    if (!albumName.trim()) {
      setError('Please enter an album name.')
      return
    }
    setCreatingAlbum(true)
    setMessage('')
    setError('')
    try {
      const { album } = await adminApi.createGalleryAlbum({
        name: albumName.trim(),
        description: albumDescription.trim() || null,
        coverImage: albumCoverPreview || null,
      })
      setAlbums(c => [album, ...c])
      setSelectedAlbum(album)
      setAlbumName('')
      setAlbumDescription('')
      setAlbumCoverPreview('')
      if (coverInputRef.current) coverInputRef.current.value = ''
      setMessage(`Album "${album.name}" created successfully. You can now add photos to it.`)
      setTimeout(() => setMessage(''), 4000)
    } catch (err) {
      setError(err.message || 'Failed to create album.')
    } finally {
      setCreatingAlbum(false)
    }
  }

  async function handlePhotosSelected(e) {
    const files = e.target.files
    if (!files || files.length === 0) return
    setError('')
    try {
      const loaded = await readMultipleImageFiles(files)
      const newStaged = loaded.map(item => ({
        id: 'staged_' + Math.random().toString(36).slice(2, 9),
        name: item.name,
        size: item.size,
        dataUrl: item.dataUrl,
      }))
      setStagedPhotos(curr => [...curr, ...newStaged])
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      setError('Failed to read selected image files: ' + err.message)
    }
  }

  function removeStagedPhoto(id) {
    setStagedPhotos(curr => curr.filter(p => p.id !== id))
  }

  function clearStagedPhotos() {
    setStagedPhotos([])
    setBatchCaption('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function uploadStagedPhotos(e) {
    e.preventDefault()
    if (!selectedAlbum) return
    if (stagedPhotos.length === 0) {
      setError('Please select at least one photo to upload.')
      return
    }

    setUploading(true)
    setMessage('')
    setError('')

    try {
      const photosPayload = stagedPhotos.map(p => ({
        imageUrl: p.dataUrl,
        caption: batchCaption ? batchCaption.trim() : null,
      }))

      const res = await adminApi.addGalleryPhotos(selectedAlbum.id, photosPayload)
      const addedPhotos = res.photos || (res.photo ? [res.photo] : [])

      setSelectedAlbum(a => ({
        ...a,
        coverImage: a.coverImage || addedPhotos[0]?.imageUrl || null,
        photos: [...addedPhotos, ...(a.photos || [])],
      }))

      setAlbums(curr =>
        curr.map(a => {
          if (a.id === selectedAlbum.id) {
            return {
              ...a,
              coverImage: a.coverImage || addedPhotos[0]?.imageUrl || null,
              photos: [...addedPhotos, ...(a.photos || [])],
            }
          }
          return a
        })
      )

      clearStagedPhotos()
      setMessage(`✓ ${addedPhotos.length} photo${addedPhotos.length > 1 ? 's' : ''} uploaded successfully to "${selectedAlbum.name}".`)
      setTimeout(() => setMessage(''), 4000)
    } catch (err) {
      setError(err.message || 'Failed to upload photos.')
    } finally {
      setUploading(false)
    }
  }

  async function removeAlbum(albumId, e) {
    if (e) e.stopPropagation()
    if (!confirm('Are you sure you want to delete this album and all its photos?')) return
    try {
      await adminApi.deleteGalleryAlbum(albumId)
      setAlbums(c => c.filter(a => a.id !== albumId))
      if (selectedAlbum?.id === albumId) setSelectedAlbum(null)
      setMessage('Album deleted.')
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      setError(err.message)
    }
  }

  async function removePhoto(albumId, photoId, e) {
    if (e) e.stopPropagation()
    if (!confirm('Are you sure you want to delete this photo?')) return
    try {
      await adminApi.deleteGalleryPhoto(albumId, photoId)
      setSelectedAlbum(a => ({ ...a, photos: a.photos.filter(p => p.id !== photoId) }))
      setAlbums(c => c.map(a => (a.id === albumId ? { ...a, photos: a.photos.filter(p => p.id !== photoId) } : a)))
      if (activeLightbox?.id === photoId) setActiveLightbox(null)
      setMessage('Photo deleted.')
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <LivePortal user={user} logout={logout} activeTab="admin-gallery" onNavigate={onNavigate} title="GALLERY STUDIO">
      <section className="gallery-section">
        <div className="event-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate('admin-dashboard')}>
              ← COMMAND CENTER
            </button>
            <p className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Icon8 name="irisScan" size={14} /> VISUAL MEDIA REPOSITORY
            </p>
            <h1>Media & Gallery Studio</h1>
            <p>Create event photo albums, stage high-resolution batch uploads, and curate official club memories.</p>
          </div>
        </div>

        {message && <p className="member-form-success" style={{ marginBottom: '16px' }}>{message}</p>}
        {error && <p className="member-form-error" style={{ marginBottom: '16px' }}>{error}</p>}

        {/* Studio Command Grid (Create Album & Batch Uploader) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '20px', marginBottom: '32px' }}>
          
          {/* Card 1: Professional Create Photo Album Form */}
          <article className="account-form-card" style={{ padding: '24px', background: 'var(--panel-bg)', borderRadius: '16px', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <span style={{ display: 'inline-flex', padding: '8px', borderRadius: '10px', background: 'var(--brand-glow)', color: 'var(--brand-primary)' }}>
                <Icon8 name="irisScan" size={18} />
              </span>
              <div>
                <p className="eyebrow" style={{ margin: 0, fontSize: '10px', color: 'var(--brand-primary)', letterSpacing: '0.06em' }}>
                  NEW ALBUM
                </p>
                <h2 style={{ font: '700 18px Syne', color: 'var(--text-main)', margin: '2px 0 0' }}>
                  Create Photo Album
                </h2>
              </div>
            </div>

            <form onSubmit={createAlbum} style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px', letterSpacing: '0.02em' }}>
                  Album Name *
                </label>
                <input
                  required
                  placeholder="e.g. National Cyber Hackathon 2026 / Orientation Fest"
                  value={albumName}
                  onChange={e => setAlbumName(e.target.value)}
                  style={{ width: '100%', height: '40px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)', padding: '0 12px', fontSize: '12px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px', letterSpacing: '0.02em' }}>
                  Description / Event Context
                </label>
                <input
                  placeholder="e.g. Keynote speeches, live CTF rounds, and award ceremony..."
                  value={albumDescription}
                  onChange={e => setAlbumDescription(e.target.value)}
                  style={{ width: '100%', height: '40px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)', padding: '0 12px', fontSize: '12px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px', letterSpacing: '0.02em' }}>
                  Album Cover Image (Optional)
                </label>
                
                {albumCoverPreview ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: 'var(--bg-input)', borderRadius: '10px', border: '1px solid var(--brand-border-subtle)' }}>
                    <img
                      src={albumCoverPreview}
                      alt="Cover Preview"
                      style={{ width: '64px', height: '64px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--line)', flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <b style={{ fontSize: '12px', color: 'var(--text-main)', display: 'block' }}>Cover Image Selected</b>
                      <small style={{ color: '#10b981', fontSize: '11px', display: 'block' }}>Ready to set as album hero thumbnail</small>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setAlbumCoverPreview(''); if (coverInputRef.current) coverInputRef.current.value = '' }}
                      style={{ background: 'transparent', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171', borderRadius: '6px', padding: '4px 8px', fontSize: '10px', cursor: 'pointer' }}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => coverInputRef.current?.click()}
                    style={{
                      border: '1px dashed var(--line)',
                      borderRadius: '10px',
                      padding: '16px',
                      textAlign: 'center',
                      background: 'var(--bg-input)',
                      cursor: 'pointer',
                      transition: 'border-color 0.2s ease',
                    }}
                  >
                    <Icon8 name="irisScan" size={24} style={{ color: 'var(--brand-primary)', opacity: 0.8, marginBottom: '6px' }} />
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-main)', fontWeight: 600 }}>Click to browse album cover</p>
                    <small style={{ color: 'var(--text-dim)', fontSize: '10px', display: 'block', marginTop: '2px' }}>PNG, JPG, or WEBP (Recommended ratio 16:9 or 4:3)</small>
                  </div>
                )}
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  onChange={e => { const f = e.target.files?.[0]; if (f) readImageFile(f, setAlbumCoverPreview) }}
                  style={{ display: 'none' }}
                />
              </div>

              <div style={{ marginTop: 'auto', paddingTop: '8px' }}>
                <button
                  type="submit"
                  className="primary member-submit"
                  disabled={creatingAlbum}
                  style={{ width: '100%', height: '42px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em' }}
                >
                  {creatingAlbum ? 'CREATING ALBUM…' : '+ CREATE PHOTO ALBUM'}
                </button>
              </div>
            </form>
          </article>

          {/* Card 2: Professional Multiple Photo Uploader */}
          <article className="account-form-card" style={{ padding: '24px', background: 'var(--panel-bg)', borderRadius: '16px', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column' }}>
            {selectedAlbum ? (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <p className="eyebrow" style={{ margin: 0, fontSize: '10px', color: 'var(--brand-primary)', letterSpacing: '0.06em' }}>
                      BATCH PHOTO UPLOADER
                    </p>
                    <h2 style={{ font: '700 18px Syne', color: 'var(--text-main)', margin: '2px 0 0' }}>
                      Add Photos to "{selectedAlbum.name}"
                    </h2>
                  </div>
                  <span className="badge" style={{ background: 'var(--panel-subtle)', color: 'var(--brand-primary)', border: '1px solid var(--line)', padding: '3px 9px', fontSize: '11px' }}>
                    {selectedAlbum.photos?.length || 0} in album
                  </span>
                </div>

                <form onSubmit={uploadStagedPhotos} style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
                  {/* Multi-Photo Dropzone */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: '1px dashed var(--brand-primary)',
                      borderRadius: '12px',
                      padding: '18px',
                      textAlign: 'center',
                      background: 'var(--brand-badge-bg)',
                      cursor: 'pointer',
                    }}
                  >
                    <Icon8 name="irisScan" size={28} style={{ color: 'var(--brand-primary)', marginBottom: '6px' }} />
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-main)', fontWeight: 700 }}>
                      Click to choose photos (Select Single or Multiple)
                    </p>
                    <small style={{ color: 'var(--brand-primary)', fontSize: '10px', display: 'block', marginTop: '2px' }}>
                      JPG, PNG, WebP · High resolution supported
                    </small>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handlePhotosSelected}
                      style={{ display: 'none' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px', letterSpacing: '0.02em' }}>
                      Batch Caption (Optional)
                    </label>
                    <input
                      placeholder="e.g. Stage presentations, coding round, and award ceremony..."
                      value={batchCaption}
                      onChange={e => setBatchCaption(e.target.value)}
                      style={{ width: '100%', height: '40px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)', padding: '0 12px', fontSize: '12px' }}
                    />
                  </div>

                  {/* Staged Photos Preview Grid */}
                  {stagedPhotos.length > 0 && (
                    <div style={{ background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '10px', padding: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <b style={{ color: 'var(--brand-primary)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          ✓ {stagedPhotos.length} Photo{stagedPhotos.length > 1 ? 's' : ''} Staged for Upload
                        </b>
                        <button
                          type="button"
                          onClick={clearStagedPhotos}
                          style={{ background: 'transparent', border: 0, color: '#f87171', fontSize: '10px', cursor: 'pointer', fontWeight: 600 }}
                        >
                          ✕ Clear All
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: '8px', maxHeight: '160px', overflowY: 'auto', paddingRight: '4px' }}>
                        {stagedPhotos.map(p => (
                          <div key={p.id} style={{ position: 'relative', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--line)', background: '#000' }}>
                            <img src={p.dataUrl} alt={p.name} style={{ width: '100%', height: '56px', objectFit: 'cover', display: 'block' }} />
                            <button
                              type="button"
                              onClick={() => removeStagedPhoto(p.id)}
                              title="Remove photo"
                              style={{
                                position: 'absolute',
                                top: '2px',
                                right: '2px',
                                width: '16px',
                                height: '16px',
                                borderRadius: '50%',
                                background: 'rgba(239, 68, 68, 0.9)',
                                color: '#fff',
                                border: 0,
                                fontSize: '9px',
                                display: 'grid',
                                placeItems: 'center',
                                cursor: 'pointer',
                                padding: 0,
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: 'auto', paddingTop: '8px' }}>
                    <button
                      type="submit"
                      className="primary member-submit"
                      disabled={uploading || stagedPhotos.length === 0}
                      style={{ width: '100%', height: '42px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em' }}
                    >
                      {uploading
                        ? `UPLOADING ${stagedPhotos.length} PHOTO${stagedPhotos.length > 1 ? 'S' : ''}…`
                        : stagedPhotos.length > 0
                        ? `+ UPLOAD ${stagedPhotos.length} PHOTO${stagedPhotos.length > 1 ? 'S' : ''} TO ALBUM`
                        : 'SELECT PHOTOS TO UPLOAD'}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', flex: 1, padding: '24px 16px', background: 'var(--panel-subtle)', borderRadius: '12px', border: '1px dashed var(--line)' }}>
                <Icon8 name="irisScan" size={32} style={{ color: 'var(--brand-primary)', opacity: 0.6, marginBottom: '10px' }} />
                <h3 style={{ font: '700 16px Syne', color: 'var(--text-main)', margin: '0 0 4px' }}>
                  No Album Selected
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', maxWidth: '320px', lineHeight: 1.5 }}>
                  Select an existing album below to upload photos, or create a new album using the form on the left.
                </p>

                {albums.length > 0 && (
                  <div style={{ marginTop: '16px', width: '100%' }}>
                    <small style={{ display: 'block', fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                      Quick Select Recent Album:
                    </small>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
                      {albums.slice(0, 4).map(a => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => setSelectedAlbum(a)}
                          style={{
                            fontSize: '11px',
                            padding: '4px 10px',
                            borderRadius: '16px',
                            background: 'var(--bg-input)',
                            border: '1px solid var(--line)',
                            color: 'var(--text-main)',
                            cursor: 'pointer',
                          }}
                        >
                          {a.name} ({a.photos?.length || 0})
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </article>
        </div>

        {/* Albums Directory Section */}
        <div className="section-title" style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <p className="eyebrow" style={{ margin: '0 0 4px', fontSize: '10px', color: 'var(--brand-primary)', letterSpacing: '0.06em' }}>
              ALBUM DIRECTORY
            </p>
            <h2 style={{ font: '700 20px Syne', color: 'var(--text-main)', margin: 0 }}>
              All Albums ({albums.length})
            </h2>
          </div>
        </div>

        {loading ? (
          <p className="directory-state">Loading gallery albums...</p>
        ) : albums.length === 0 ? (
          <p className="directory-state">No albums created yet. Use the creation card above to create your first album.</p>
        ) : (
          <div className="gallery-grid" style={{ marginTop: '16px' }}>
            {albums.map(a => {
              const isSelected = selectedAlbum?.id === a.id
              return (
                <div
                  key={a.id}
                  className="album-card-box"
                  onClick={() => setSelectedAlbum(a)}
                  style={{
                    borderColor: isSelected ? 'var(--brand-primary)' : undefined,
                    boxShadow: isSelected ? '0 0 16px rgba(72, 183, 244, 0.25)' : undefined,
                    cursor: 'pointer',
                  }}
                >
                  <div className="album-cover">
                    {a.coverImage || a.photos?.[0]?.imageUrl ? (
                      <img src={a.coverImage || a.photos[0].imageUrl} alt={a.name} />
                    ) : (
                      <div className="album-cover-placeholder">{a.name.slice(0, 2).toUpperCase()}</div>
                    )}
                    <span className="album-photo-count">{a.photos?.length || 0} photos</span>
                  </div>
                  <div className="album-details">
                    <h3>{a.name}</h3>
                    <p>{a.description || 'Club photo collection'}</p>
                  </div>
                  <div style={{ padding: '8px 12px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <small style={{ color: isSelected ? 'var(--brand-primary)' : 'var(--text-dim)', fontWeight: isSelected ? 700 : 400 }}>
                      {isSelected ? '✓ Active Album' : 'Click to Manage'}
                    </small>
                    <button type="button" className="action-btn delete-btn" onClick={e => removeAlbum(a.id, e)} title="Delete entire album">
                      Delete
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Selected Album Photos Grid */}
        {selectedAlbum && (
          <div style={{ marginTop: '36px', borderTop: '1px solid var(--line)', paddingTop: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <p className="eyebrow" style={{ margin: '0 0 4px', fontSize: '10px', color: 'var(--brand-primary)', letterSpacing: '0.06em' }}>
                  ACTIVE ALBUM PHOTOS
                </p>
                <h2 style={{ font: '700 20px Syne', color: 'var(--text-main)', margin: 0 }}>
                  {selectedAlbum.name} ({selectedAlbum.photos?.length || 0} Photos)
                </h2>
              </div>
              <button type="button" className="action-btn delete-btn" onClick={e => removeAlbum(selectedAlbum.id, e)}>
                Delete Entire Album
              </button>
            </div>

            {(!selectedAlbum.photos || selectedAlbum.photos.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '36px 20px', background: 'var(--panel-subtle)', borderRadius: '12px', border: '1px dashed var(--line)', marginTop: '16px' }}>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
                  No photos uploaded to "{selectedAlbum.name}" yet. Use the Batch Photo Uploader above to add event photos.
                </p>
              </div>
            ) : (
              <div className="gallery-grid" style={{ marginTop: '16px' }}>
                {selectedAlbum.photos.map(p => (
                  <div key={p.id} className="album-card-box" style={{ position: 'relative' }}>
                    <div className="album-cover" onClick={() => setActiveLightbox(p)} style={{ cursor: 'pointer' }}>
                      <img src={p.imageUrl} alt={p.caption || 'Event'} />
                    </div>
                    {p.caption && (
                      <div className="album-details" onClick={() => setActiveLightbox(p)} style={{ cursor: 'pointer' }}>
                        <p>{p.caption}</p>
                      </div>
                    )}
                    <div style={{ padding: '6px 10px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end' }}>
                      <button type="button" className="action-btn delete-btn" onClick={e => removePhoto(selectedAlbum.id, p.id, e)}>
                        Remove Photo
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Lightbox Modal with Full Navigation */}
        {activeLightbox && (
          <GalleryLightbox
            photos={selectedAlbum?.photos || []}
            activePhoto={activeLightbox}
            albumName={selectedAlbum?.name}
            onClose={() => setActiveLightbox(null)}
            onSelectPhoto={p => setActiveLightbox(p)}
            onDeletePhoto={selectedAlbum ? (photoId, e) => removePhoto(selectedAlbum.id, photoId, e) : null}
          />
        )}
      </section>
    </LivePortal>
  )
}

// ----------------------------------------------------
// Campus & Event Reels Studio (Admin & PR / Event Leads)
// ----------------------------------------------------
function ReelsManagement({ user, logout, onNavigate }) {
  const { platformMode } = usePlatformTheme()
  const isMrdu = platformMode === 'MRDU_EVENTS'
  const [reels, setReels] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [directorySearch, setDirectorySearch] = useState('')
  const [directoryCategory, setDirectoryCategory] = useState('ALL')
  const [page, setPage] = useState(1)
  const pageSize = 12

  // Form states
  const [creatorTab, setCreatorTab] = useState('SINGLE') // 'SINGLE' | 'PROFILE'
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [authorHandle, setAuthorHandle] = useState('cybersecurityclub_mrdu')
  const [audioTitle, setAudioTitle] = useState('cybersecurityclub_mrdu • Original audio')
  const [category, setCategory] = useState('CAMPUS_LIFE')
  const [reelPlatformMode, setReelPlatformMode] = useState(isMrdu ? 'MRDU_EVENTS' : 'ALL')
  const [isFeatured, setIsFeatured] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Profile Sync states
  const [profileUrl, setProfileUrl] = useState('https://www.instagram.com/cybersecurityclub_mrdu/')
  const [profileHandle, setProfileHandle] = useState('cybersecurityclub_mrdu')
  const [profilePostLinks, setProfilePostLinks] = useState('')
  const [profileCategory, setProfileCategory] = useState('CAMPUS_LIFE')
  const [profileStreamMode, setProfileStreamMode] = useState(isMrdu ? 'MRDU_EVENTS' : 'ALL')
  const [profileTitlePrefix, setProfileTitlePrefix] = useState('Campus Highlights')
  const [profileSyncing, setProfileSyncing] = useState(false)

  // Parse URL for real-time live embed preview
  const liveParsed = useMemo(() => {
    const raw = (url || '').trim()
    if (!raw) return null
    if (raw.includes('youtube.com/shorts/') || raw.includes('youtu.be/') || raw.includes('youtube.com/watch') || raw.includes('youtube.com/embed/')) {
      const match = raw.match(/(?:shorts\/|v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]+)/i)
      const id = match ? match[1] : null
      return id ? { type: 'YOUTUBE_SHORT', embedUrl: `https://www.youtube.com/embed/${id}?autoplay=0&loop=1&rel=0` } : null
    }
    const igMatch = raw.match(/instagram\.com\/(?:[a-zA-Z0-9_.]+\/)?(?:reel|reels|p|tv|share\/reel)\/([a-zA-Z0-9_-]+)/i)
    if (igMatch) {
      return { type: 'INSTAGRAM', embedUrl: `https://www.instagram.com/reel/${igMatch[1]}/embed/` }
    }
    if (/\.(mp4|webm|mov)(\?.*)?$/i.test(raw)) {
      return { type: 'DIRECT_VIDEO', embedUrl: raw }
    }
    return { type: 'EXTERNAL', embedUrl: raw }
  }, [url])

  function loadReels() {
    setLoading(true)
    adminApi.listReels()
      .then(res => setReels(res.reels || []))
      .catch(err => setError(err.message || 'Failed to load reels.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadReels()
  }, [])

  async function handlePublishReel(e) {
    e.preventDefault()
    if (!url.trim() || !title.trim()) {
      setError('Please provide both a video URL and a title.')
      return
    }
    setSubmitting(true)
    setError('')
    setMessage('')
    try {
      await adminApi.createReel({
        url: url.trim(),
        title: title.trim(),
        description: description.trim(),
        authorHandle: authorHandle.trim(),
        audioTitle: audioTitle.trim(),
        category,
        platformMode: reelPlatformMode,
        isFeatured,
      })
      setMessage('✓ Campus Reel published successfully! Pushed as TOP PRIORITY for all students.')
      setUrl('')
      setTitle('')
      setDescription('')
      setIsFeatured(false)
      loadReels()
    } catch (err) {
      setError(err.message || 'Failed to publish reel.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSyncProfile(e) {
    e.preventDefault()
    if (!profileUrl.trim() && !profileHandle.trim()) {
      setError('Please provide an Instagram profile URL or handle.')
      return
    }
    setProfileSyncing(true)
    setError('')
    setMessage('')
    try {
      const res = await adminApi.importProfileReels({
        profileUrl: profileUrl.trim(),
        handle: profileHandle.trim(),
        category: profileCategory,
        platformMode: profileStreamMode,
        postLinks: profilePostLinks.trim(),
        titlePrefix: profileTitlePrefix.trim(),
        count: 5,
      })
      setMessage(res.message || '✓ Instagram profile posts synced successfully into random student playback!')
      setProfilePostLinks('')
      loadReels()
    } catch (err) {
      setError(err.message || 'Failed to sync Instagram profile.')
    } finally {
      setProfileSyncing(false)
    }
  }

  async function toggleReelStatus(reel) {
    try {
      await adminApi.updateReel(reel.id, { isActive: !reel.isActive })
      setReels(curr => curr.map(r => r.id === reel.id ? { ...r, isActive: !r.isActive } : r))
    } catch (err) {
      setError(err.message || 'Failed to update reel status.')
    }
  }

  async function toggleFeatured(reel) {
    try {
      await adminApi.updateReel(reel.id, { isFeatured: !reel.isFeatured })
      setReels(curr => curr.map(r => r.id === reel.id ? { ...r, isFeatured: !r.isFeatured } : r))
    } catch (err) {
      setError(err.message || 'Failed to toggle featured status.')
    }
  }

  async function handleDeleteReel(id) {
    if (!window.confirm('Are you sure you want to delete this reel?')) return
    try {
      await adminApi.deleteReel(id)
      setReels(curr => curr.filter(r => r.id !== id))
      setMessage('✓ Reel deleted successfully.')
    } catch (err) {
      setError(err.message || 'Failed to delete reel.')
    }
  }

  return (
    <LivePortal user={user} logout={logout} activeTab="admin-reels" onNavigate={onNavigate} title={isMrdu ? 'MRDU REELS STUDIO' : 'CAMPUS REELS STUDIO'}>
      <section className="gallery-section">
        <div className="event-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate('admin-dashboard')}>
              ← COMMAND CENTER
            </button>
            <p className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <IconVideo size={14} /> SHORT-FORM CAMPUS MEDIA & HIGHLIGHTS
            </p>
            <h1>{isMrdu ? 'MRDU Campus Reels Studio' : 'Campus & Event Reels Studio'}</h1>
            <p>Publish and curate Instagram reels and video highlights for students. Admin uploads are automatically prioritized in student feeds.</p>
          </div>
        </div>

        {message && <p className="member-form-success">{message}</p>}
        {error && <p className="member-form-error">{error}</p>}

        {/* Creator Mode Switcher Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: 'var(--panel-subtle)', padding: '6px', borderRadius: '12px', width: 'fit-content', border: '1px solid var(--line)' }}>
          <button
            type="button"
            onClick={() => setCreatorTab('SINGLE')}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              border: 0,
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: creatorTab === 'SINGLE' ? 'var(--brand-primary)' : 'transparent',
              color: creatorTab === 'SINGLE' ? '#050c14' : 'var(--text-muted)',
              transition: 'all 0.15s ease',
            }}
          >
            <IconVideo size={15} /> Single Reel / Post (Top Priority Push)
          </button>
          <button
            type="button"
            onClick={() => setCreatorTab('PROFILE')}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              border: 0,
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: creatorTab === 'PROFILE' ? 'var(--brand-primary)' : 'transparent',
              color: creatorTab === 'PROFILE' ? '#050c14' : 'var(--text-muted)',
              transition: 'all 0.15s ease',
            }}
          >
            <IconInstagram size={15} /> Upload Profile Link (Random Discovery Stream)
          </button>
        </div>

        {/* Side-by-Side Creator Layout: Form on Left, Live Preview on Right */}
        <div className="reel-creator-layout">
          {/* Left Column: Mode 1 (Single Reel) or Mode 2 (Profile Sync) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {creatorTab === 'SINGLE' ? (
              <article className="account-form-card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <p className="eyebrow" style={{ margin: 0 }}>DIRECT ADMIN UPLOAD</p>
                  <span className="badge" style={{ background: 'var(--brand-badge-bg)', color: 'var(--brand-primary)', fontSize: '10px', fontWeight: 800 }}>
                    ★ TOP PRIORITY 1 FOR STUDENTS
                  </span>
                </div>
                <h2>Publish Campus Reel</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.5, margin: '0 0 16px' }}>
                  Paste an Instagram Reel, YouTube Short, or MP4 link. The video will be highlighted at the top of all students' feeds immediately.
                </p>

                <form onSubmit={handlePublishReel} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                      Instagram Reel / Video Link URL *
                    </label>
                    <input
                      value={url}
                      onChange={e => setUrl(e.target.value)}
                      placeholder="https://www.instagram.com/reel/C8qL_k1S9gW/ or video URL"
                      required
                      style={{ width: '100%', height: '42px', padding: '0 14px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)' }}
                    />
                    <small style={{ display: 'block', color: 'var(--text-dim)', fontSize: '11px', marginTop: '4px' }}>
                      Paste any Instagram reel link. The live preview on the right will update in real time.
                    </small>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                      Title / Caption Headline *
                    </label>
                    <input
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder="e.g. Grand Induction & Live CTF Defense Battle 2026"
                      required
                      style={{ width: '100%', height: '42px', padding: '0 14px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                        Instagram Account / Handle
                      </label>
                      <input
                        value={authorHandle}
                        onChange={e => setAuthorHandle(e.target.value)}
                        placeholder="cybersecurityclub_mrdu"
                        style={{ width: '100%', height: '42px', padding: '0 12px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)' }}
                      />
                      <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                        <button
                          type="button"
                          onClick={() => { setAuthorHandle('cybersecurityclub_mrdu'); setAudioTitle('cybersecurityclub_mrdu • Original audio') }}
                          style={{ fontSize: '10px', padding: '2px 6px', background: 'var(--panel-subtle)', border: '1px solid var(--line)', borderRadius: '4px', color: 'var(--brand-primary)', cursor: 'pointer' }}
                        >
                          @cybersecurityclub_mrdu
                        </button>
                        <button
                          type="button"
                          onClick={() => { setAuthorHandle('mrdu_official'); setAudioTitle('mrdu_official • Original audio') }}
                          style={{ fontSize: '10px', padding: '2px 6px', background: 'var(--panel-subtle)', border: '1px solid var(--line)', borderRadius: '4px', color: 'var(--brand-primary)', cursor: 'pointer' }}
                        >
                          @mrdu_official
                        </button>
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                        Audio Track Title
                      </label>
                      <input
                        value={audioTitle}
                        onChange={e => setAudioTitle(e.target.value)}
                        placeholder="cybersecurityclub_mrdu • Original audio"
                        style={{ width: '100%', height: '42px', padding: '0 12px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                      Full Post Caption & Hashtags (Optional)
                    </label>
                    <textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Highlights from the event... #MRDU #CyberSecurity #Hackathon"
                      rows={3}
                      style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)', resize: 'vertical' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                        Category
                      </label>
                      <select
                        value={category}
                        onChange={e => setCategory(e.target.value)}
                        style={{ width: '100%', height: '42px', padding: '0 12px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)' }}
                      >
                        <option value="CAMPUS_LIFE">Campus Life & Highlights</option>
                        <option value="HACKATHONS">Hackathons & CTF Competitions</option>
                        <option value="WORKSHOPS">Technical Workshops & Labs</option>
                        <option value="CULTURAL">Cultural & University Fests</option>
                        <option value="TECH_NEWS">Cyber Security & Tech Updates</option>
                        <option value="MRDU_SPECIAL">MRDU Central Highlights</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                        Platform Stream
                      </label>
                      <select
                        value={reelPlatformMode}
                        onChange={e => setReelPlatformMode(e.target.value)}
                        style={{ width: '100%', height: '42px', padding: '0 12px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)' }}
                      >
                        <option value="ALL">All Portals (Global)</option>
                        <option value="CSC">Cyber Security Club Stream</option>
                        <option value="MRDU_EVENTS">MRDU Central Events Stream</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px' }}>
                    <input
                      type="checkbox"
                      id="featured-toggle"
                      checked={isFeatured}
                      onChange={e => setIsFeatured(e.target.checked)}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <label htmlFor="featured-toggle" style={{ margin: 0, fontSize: '12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--text-main)' }}>
                      <IconFlame size={14} style={{ color: '#f59e0b' }} /> Pin as Featured Reel
                    </label>
                  </div>

                  <button className="primary member-submit" disabled={submitting} style={{ height: '46px', fontSize: '13px', fontWeight: 700, letterSpacing: '0.04em' }}>
                    {submitting ? 'PUBLISHING REEL...' : 'PUBLISH & PUSH TO STUDENTS (PRIORITY 1) →'}
                  </button>
                </form>
              </article>
            ) : (
              /* Mode 2: Instagram Profile Sync */
              <article className="account-form-card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <p className="eyebrow" style={{ margin: 0, color: '#ec4899' }}>INSTAGRAM PROFILE STREAM SYNC</p>
                  <span className="badge" style={{ background: 'rgba(236,72,153,0.12)', color: '#ec4899', fontSize: '10px', fontWeight: 800 }}>
                    RANDOM DISCOVERY POOL
                  </span>
                </div>
                <h2>Sync Instagram Profile Feed</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.6', margin: '0 0 16px' }}>
                  Upload an Instagram profile link so all posts and reels from that account play randomly in the students' Reels Feed. When you upload a new reel directly, it automatically becomes the #1 main priority!
                </p>

                <form onSubmit={handleSyncProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                        Instagram Profile URL *
                      </label>
                      <input
                        value={profileUrl}
                        onChange={e => {
                          setProfileUrl(e.target.value)
                          const m = e.target.value.match(/instagram\.com\/([a-zA-Z0-9_.]+)/i)
                          if (m && m[1]) setProfileHandle(m[1].replace(/\/$/, ''))
                        }}
                        placeholder="https://www.instagram.com/cybersecurityclub_mrdu/"
                        required
                        style={{ width: '100%', height: '42px', padding: '0 12px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                        Handle / Username
                      </label>
                      <input
                        value={profileHandle}
                        onChange={e => setProfileHandle(e.target.value)}
                        placeholder="cybersecurityclub_mrdu"
                        required
                        style={{ width: '100%', height: '42px', padding: '0 12px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                      Title Prefix
                    </label>
                    <input
                      value={profileTitlePrefix}
                      onChange={e => setProfileTitlePrefix(e.target.value)}
                      placeholder="Campus Highlights"
                      style={{ width: '100%', height: '42px', padding: '0 12px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                      Specific Post/Reel URLs from this Profile (Optional, one per line)
                    </label>
                    <textarea
                      value={profilePostLinks}
                      onChange={e => setProfilePostLinks(e.target.value)}
                      placeholder={'https://www.instagram.com/reel/C8qL_k1S9gW/\nhttps://www.instagram.com/p/C8tM_p2R7hX/'}
                      rows={4}
                      style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)', resize: 'vertical', fontFamily: 'monospace', fontSize: '11px' }}
                    />
                    <small style={{ display: 'block', color: 'var(--text-dim)', fontSize: '11px', marginTop: '4px' }}>
                      Leave empty to auto-sync the profile stream discovery pool, or paste multiple post URLs to import in batch.
                    </small>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                        Category
                      </label>
                      <select
                        value={profileCategory}
                        onChange={e => setProfileCategory(e.target.value)}
                        style={{ width: '100%', height: '42px', padding: '0 12px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)' }}
                      >
                        <option value="CAMPUS_LIFE">Campus Life & Highlights</option>
                        <option value="HACKATHONS">Hackathons & CTF Competitions</option>
                        <option value="WORKSHOPS">Technical Workshops & Labs</option>
                        <option value="CULTURAL">Cultural & University Fests</option>
                        <option value="TECH_NEWS">Cyber Security & Tech Updates</option>
                        <option value="MRDU_SPECIAL">MRDU Central Highlights</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                        Platform Stream
                      </label>
                      <select
                        value={profileStreamMode}
                        onChange={e => setProfileStreamMode(e.target.value)}
                        style={{ width: '100%', height: '42px', padding: '0 12px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)' }}
                      >
                        <option value="ALL">All Portals (Global)</option>
                        <option value="CSC">Cyber Security Club Stream</option>
                        <option value="MRDU_EVENTS">MRDU Central Events Stream</option>
                      </select>
                    </div>
                  </div>

                  <button className="primary member-submit" disabled={profileSyncing} style={{ height: '46px', fontSize: '13px', fontWeight: 700, letterSpacing: '0.04em', background: 'linear-gradient(135deg, #ec4899, #8b5cf6)', borderColor: '#ec4899' }}>
                    {profileSyncing ? 'SYNCING PROFILE POSTS...' : `SYNC @${profileHandle || 'PROFILE'} POSTS & REELS POOL →`}
                  </button>
                </form>
              </article>
            )}
          </div>

          {/* Right Column: Sticky Live Embed Preview Player */}
          <article
            className="account-form-card"
            style={{
              position: 'sticky',
              top: '20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-start',
              background: 'var(--bg-card)',
              padding: '20px 16px',
              border: '1px solid var(--brand-border-subtle)',
              borderRadius: '18px',
              boxShadow: '0 10px 35px rgba(0,0,0,0.06)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '14px', padding: '0 4px' }}>
              <p className="eyebrow" style={{ margin: 0, fontSize: '10px' }}>LIVE PLAYER PREVIEW</p>
              {liveParsed && (
                <span className="badge" style={{ fontSize: '9px', fontWeight: 700, background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                  ● {liveParsed.type.replace('_', ' ')}
                </span>
              )}
            </div>

            {/* Simulated Phone Shell */}
            <div
              style={{
                width: '100%',
                maxWidth: '300px',
                height: '520px',
                background: '#000000',
                borderRadius: '24px',
                border: '3px solid #1e293b',
                boxShadow: '0 16px 45px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.1)',
                overflow: 'hidden',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Top Camera Notch */}
              <div style={{ position: 'absolute', top: '8px', left: '50%', transform: 'translateX(-50%)', width: '60px', height: '14px', background: '#111827', borderRadius: '10px', zIndex: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#1e293b' }} />
              </div>

              {/* Video Player Canvas */}
              <div style={{ width: '100%', height: '100%', position: 'relative', background: '#000000', overflow: 'hidden' }}>
                {liveParsed ? (
                  liveParsed.type === 'DIRECT_VIDEO' ? (
                    <video src={liveParsed.embedUrl} autoPlay loop muted playsInline controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <iframe
                      src={liveParsed.embedUrl}
                      title="Live Preview"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      scrolling="no"
                      style={{ width: '100%', height: '100%', border: 0, overflow: 'hidden', background: '#000000' }}
                    />
                  )
                ) : (
                  <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', color: 'var(--text-muted)', textAlign: 'center' }}>
                    <span style={{ display: 'inline-flex', padding: '14px', borderRadius: '50%', background: 'var(--brand-badge-bg)', color: 'var(--brand-primary)', marginBottom: '12px' }}>
                      <IconVideo size={28} />
                    </span>
                    <b style={{ color: 'var(--text-main)', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Interactive Preview</b>
                    <p style={{ fontSize: '11px', margin: 0, lineHeight: 1.5 }}>
                      Type or paste an Instagram Reel URL on the left to test playback live in this simulated screen.
                    </p>
                  </div>
                )}

                {/* Simulated Bottom Overlay */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: '24px 12px 12px',
                    background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.4) 70%, transparent 100%)',
                    color: '#ffffff',
                    zIndex: 20,
                    pointerEvents: 'none',
                  }}
                >
                  <p style={{ margin: '0 0 2px', fontSize: '11px', fontWeight: 700, color: '#ffffff' }}>
                    @{authorHandle || 'cybersecurityclub_mrdu'}
                  </p>
                  <p style={{ margin: 0, fontSize: '10px', color: '#cbd5e1', lineHeight: 1.3, maxHeight: '28px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {title || 'Reel Caption Headline…'}
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: '9px', color: '#94a3b8', fontFamily: 'monospace' }}>
                    ♫ {audioTitle || 'Original audio'}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Actions / Tips under Preview */}
            <div style={{ width: '100%', maxWidth: '300px', marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-dim)' }}>
                <span>Real-time Sync Active</span>
                <button
                  type="button"
                  onClick={() => { setUrl(''); setTitle(''); setDescription('') }}
                  style={{ background: 'none', border: 'none', color: 'var(--brand-primary)', fontSize: '11px', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                >
                  Clear Inputs
                </button>
              </div>
            </div>
          </article>
        </div>

        {/* Published Reels Directory */}
        <div style={{ marginTop: '40px', borderTop: '1px solid var(--line)', paddingTop: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <p className="eyebrow">PUBLISHED FEED DIRECTORY</p>
              <h2>Manage Published Reels ({reels.length})</h2>
            </div>
            <button type="button" className="outline" onClick={loadReels} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '6px 14px' }}>
              <IconRefresh size={13} /> Refresh Feed
            </button>
          </div>

          {/* Directory Search & Filter Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', background: 'var(--bg-card)', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--brand-border-subtle)' }}>
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px', maxWidth: '100%' }}>
              {[
                { id: 'ALL', label: 'All Categories' },
                { id: 'CAMPUS_LIFE', label: 'Campus Life' },
                { id: 'HACKATHONS', label: 'Hackathons' },
                { id: 'WORKSHOPS', label: 'Workshops' },
                { id: 'CULTURAL', label: 'Cultural' },
                { id: 'TECH_NEWS', label: 'Tech News' },
              ].map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => { setDirectoryCategory(cat.id); setPage(1) }}
                  style={{
                    fontSize: '11px',
                    padding: '4px 10px',
                    borderRadius: '16px',
                    whiteSpace: 'nowrap',
                    background: directoryCategory === cat.id ? 'var(--brand-primary)' : 'var(--panel-subtle)',
                    color: directoryCategory === cat.id ? '#ffffff' : 'var(--text-muted)',
                    border: '1px solid var(--line)',
                    cursor: 'pointer',
                    fontWeight: directoryCategory === cat.id ? 700 : 500,
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div style={{ position: 'relative', width: '220px', minWidth: '160px' }}>
              <input
                type="text"
                placeholder="Filter by title / handle…"
                value={directorySearch}
                onChange={e => { setDirectorySearch(e.target.value); setPage(1) }}
                style={{ width: '100%', height: '32px', padding: '0 10px', fontSize: '11px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--bg-input)', color: 'var(--text-main)' }}
              />
            </div>
          </div>

          {loading ? (
            <p className="directory-state">Loading reels...</p>
          ) : reels.length === 0 ? (
            <p className="directory-state">No reels published yet. Use the form above to publish your first college reel!</p>
          ) : (() => {
            const filtered = reels.filter(r => {
              if (directoryCategory !== 'ALL' && r.category !== directoryCategory) return false
              if (directorySearch.trim()) {
                const q = directorySearch.toLowerCase().trim()
                const t = (r.title || '').toLowerCase()
                const d = (r.description || '').toLowerCase()
                const h = (r.authorHandle || '').toLowerCase()
                if (!t.includes(q) && !d.includes(q) && !h.includes(q)) return false
              }
              return true
            })
            const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
            const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

            if (filtered.length === 0) {
              return <p className="directory-state">No reels matched your filter. Try adjusting your search query.</p>
            }

            return (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: '20px' }}>
                  {paginated.map(r => (
                    <article
                      key={r.id}
                      className="account-form-card"
                      style={{
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        opacity: r.isActive ? 1 : 0.6,
                        border: r.isFeatured ? '1px solid #f59e0b' : '1px solid var(--brand-border-subtle)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span className="badge" style={{ background: 'var(--brand-badge-bg)', color: 'var(--brand-badge-color)', fontSize: '10px', fontWeight: 600 }}>
                          {r.category.replace('_', ' ')}
                        </span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {r.isFeatured && (
                            <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)', fontSize: '9px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <IconFlame size={11} /> FEATURED
                            </span>
                          )}
                          <span className="badge" style={{ background: r.isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.15)', color: r.isActive ? '#10b981' : '#94a3b8', border: `1px solid ${r.isActive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(100, 116, 139, 0.3)'}`, fontSize: '9px', fontWeight: 700 }}>
                            {r.isActive ? 'LIVE' : 'HIDDEN'}
                          </span>
                        </div>
                      </div>

                      {/* Embedded Compact Preview */}
                      <div style={{ width: '100%', height: '220px', background: '#000000', borderRadius: '12px', overflow: 'hidden', marginBottom: '12px' }}>
                        {r.embedType === 'DIRECT_VIDEO' ? (
                          <video src={r.url} muted playsInline controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <iframe src={r.url} title={r.title} allowFullScreen scrolling="no" style={{ width: '100%', height: '100%', border: 0, overflow: 'hidden' }} />
                        )}
                      </div>

                      <h3 style={{ margin: '0 0 6px', fontSize: '14px', color: 'var(--text-main)' }}>{r.title}</h3>
                      {r.description && <p style={{ margin: '0 0 10px', fontSize: '11px', color: 'var(--text-muted)' }}>{r.description}</p>}

                      <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-dim)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          <span>{r.viewsCount} views</span>
                          <span>·</span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <IconHeart size={12} filled={r.likesCount > 0} /> {r.likesCount}
                          </span>
                        </span>
                        <small>By: {r.postedBy}</small>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                        <button
                          type="button"
                          className="outline"
                          onClick={() => toggleReelStatus(r)}
                          style={{ flex: 1, fontSize: '10px', padding: '6px' }}
                        >
                          {r.isActive ? 'Hide' : 'Publish'}
                        </button>
                        <button
                          type="button"
                          className="outline"
                          onClick={() => toggleFeatured(r)}
                          style={{ flex: 1, fontSize: '10px', padding: '6px', color: r.isFeatured ? '#f59e0b' : 'inherit' }}
                        >
                          {r.isFeatured ? 'Unpin' : 'Pin to Top'}
                        </button>
                        <button
                          type="button"
                          className="action-btn delete-btn"
                          onClick={() => handleDeleteReel(r.id)}
                          style={{ fontSize: '10px', padding: '6px 10px' }}
                          title="Delete reel"
                        >
                          <IconTrash size={12} />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>

                {totalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginTop: '24px' }}>
                    <button
                      type="button"
                      className="outline"
                      disabled={page <= 1}
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      style={{ fontSize: '11px', padding: '6px 14px' }}
                    >
                      ← Previous Page
                    </button>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'DM Mono' }}>
                      Page {page} of {totalPages}
                    </span>
                    <button
                      type="button"
                      className="outline"
                      disabled={page >= totalPages}
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      style={{ fontSize: '11px', padding: '6px 14px' }}
                    >
                      Next Page →
                    </button>
                  </div>
                )}
              </>
            )
          })()}
        </div>
      </section>
    </LivePortal>
  )
}

// ----------------------------------------------------
// Team Leadership Management (Admin)
// ----------------------------------------------------
function TeamManagement({ user, logout, onNavigate }) {
  const [team, setTeam] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [photoPreview, setPhotoPreview] = useState('')
  const [editingMember, setEditingMember] = useState(null)
  const [editPhotoPreview, setEditPhotoPreview] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [syncing, setSyncing] = useState(false)

  function loadTeam() {
    setLoading(true)
    adminApi.listClubTeam()
      .then(({ team: list }) => {
        const sorted = (list || []).slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        setTeam(sorted)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadTeam()
  }, [])

  async function handleSyncLeadersFromAccounts() {
    setSyncing(true)
    setMessage('')
    setError('')
    try {
      const res = await adminApi.syncClubTeamFromAccounts()
      const sorted = (res.team || []).slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      setTeam(sorted)
      setMessage(res.message || '✓ Council showcase successfully synchronized from user accounts!')
    } catch (err) {
      setError(err.message || 'Failed to auto-sync council accounts.')
    } finally {
      setSyncing(false)
    }
  }

  async function createMember(e) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setMessage('')
    setError('')
    try {
      const { member } = await adminApi.createClubTeamMember({
        name: String(form.get('name') || '').trim(),
        roleTitle: String(form.get('roleTitle') || '').trim(),
        collegeEmail: String(form.get('collegeEmail') || '').trim() || null,
        bio: String(form.get('bio') || '').trim() || null,
        photoUrl: photoPreview || null,
        instagramUrl: String(form.get('instagramUrl') || '').trim() || null,
        linkedinUrl: String(form.get('linkedinUrl') || '').trim() || null,
        githubUrl: String(form.get('githubUrl') || '').trim() || null,
        sortOrder: team.length + 1,
      })
      setTeam(c => [...c, member])
      e.currentTarget.reset()
      setPhotoPreview('')
      setMessage(`Added ${member.name} to leadership council.`)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleUpdateMember(e) {
    e.preventDefault()
    if (!editingMember) return
    const form = new FormData(e.currentTarget)
    setMessage('')
    setError('')
    setSubmitting(true)
    try {
      const payload = {
        name: String(form.get('name') || '').trim(),
        roleTitle: String(form.get('roleTitle') || '').trim(),
        collegeEmail: String(form.get('collegeEmail') || '').trim() || null,
        bio: String(form.get('bio') || '').trim() || null,
        photoUrl: editPhotoPreview || editingMember.photoUrl || null,
        instagramUrl: String(form.get('instagramUrl') || '').trim() || null,
        linkedinUrl: String(form.get('linkedinUrl') || '').trim() || null,
        githubUrl: String(form.get('githubUrl') || '').trim() || null,
      }
      const { member: updated } = await adminApi.updateClubTeamMember(editingMember.id, payload)
      setTeam(c => c.map(m => (m.id === editingMember.id ? updated : m)))
      setEditingMember(null)
      setEditPhotoPreview('')
      setMessage(`Profile updated for ${updated.name}. Changes reflected across the website.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function moveMember(index, direction) {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= team.length) return
    const updated = [...team]
    const [moved] = updated.splice(index, 1)
    updated.splice(targetIndex, 0, moved)
    setTeam(updated)
    setMessage('')
    setError('')

    try {
      await adminApi.reorderClubTeam(updated.map(m => m.id))
      setMessage(`Priority order updated: ${moved.name} is now #${targetIndex + 1}.`)
    } catch (err) {
      setError(err.message || 'Failed to save priority order.')
      loadTeam()
    }
  }

  async function removeMember(id) {
    if (!confirm('Are you sure you want to remove this leader profile?')) return
    try {
      await adminApi.deleteClubTeamMember(id)
      setTeam(c => c.filter(m => m.id !== id))
      setMessage('Team member removed.')
    } catch (err) {
      setError(err.message)
    }
  }

  function handleDownloadLeadersCsv() {
    const headers = [
      'Priority #',
      'Full Name',
      'Council Role Title',
      'Official Email',
      'Short Bio',
      'LinkedIn URL',
      'GitHub URL',
      'Instagram URL',
    ]
    const rows = team.map((l, idx) => [
      idx + 1,
      l.name,
      l.roleTitle,
      l.collegeEmail,
      l.bio,
      l.linkedinUrl,
      l.githubUrl,
      l.instagramUrl,
    ])
    downloadCsv('club_leadership_directory.csv', headers, rows)
  }

  return (
    <LivePortal user={user} logout={logout} activeTab="admin-team" onNavigate={onNavigate} title="TEAM LEADERSHIP">
      <section className="member-management">
        <div className="member-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate('admin-dashboard')}>
              ← COMMAND CENTER
            </button>
            <p className="eyebrow">COUNCIL SHOWCASE & PRIORITY</p>
            <h1>Team & Leadership Showcase</h1>
            <p>Manage public club council member profiles, auto-sync from personal accounts, and configure display priority.</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="primary"
              onClick={handleSyncLeadersFromAccounts}
              disabled={syncing}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '6px 14px', background: 'linear-gradient(135deg, #10b981, #059669)' }}
              title="Automatically scan and sync leadership council accounts into the team showcase based on role priority"
            >
              <IconSparkles size={14} /> {syncing ? 'SYNCING LEADERS…' : '⚡ AUTO-SYNC FROM ACCOUNTS'}
            </button>
            <button
              type="button"
              className="outline"
              onClick={handleDownloadLeadersCsv}
              disabled={team.length === 0}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '6px 12px' }}
              title="Download leadership directory as CSV"
            >
              <IconDownload size={14} /> DOWNLOAD CSV
            </button>
          </div>
        </div>

        {message && <p className="member-form-success">{message}</p>}
        {error && <p className="member-form-error">{error}</p>}

        <div className="member-management-grid">
          <article className="account-form-card">
            <p className="eyebrow">NEW LEADER</p>
            <h2>Add Council Member</h2>
            <form onSubmit={createMember}>
              <div className="member-form-grid">
                <label>
                  Full Name *
                  <input name="name" required placeholder="Leader Name" />
                </label>
                <label>
                  Council Role Title *
                  <input name="roleTitle" required placeholder="e.g. Student Coordinator, Tech Lead" />
                </label>
                <label>
                  Official Email
                  <input name="collegeEmail" type="email" placeholder="leader@college.edu" />
                </label>
                <label>
                  Profile Photo
                  <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) readImageFile(f, setPhotoPreview) }} />
                </label>
                <label className="form-wide">
                  Short Bio
                  <input name="bio" placeholder="Specialization & achievements..." />
                </label>
                <label>
                  LinkedIn URL
                  <input name="linkedinUrl" placeholder="https://linkedin.com/in/..." />
                </label>
                <label>
                  GitHub URL
                  <input name="githubUrl" placeholder="https://github.com/..." />
                </label>
              </div>

              {photoPreview && (
                <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <img src={photoPreview} alt="Preview" style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #52bbf5' }} />
                  <button type="button" className="action-btn delete-btn" onClick={() => setPhotoPreview('')}>Remove Photo</button>
                </div>
              )}

              <button className="primary member-submit" style={{ marginTop: '14px' }}>
                ＋ &nbsp; ADD LEADER PROFILE
              </button>
            </form>
          </article>

          <article className="member-list-card">
            <div className="card-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <p className="eyebrow">COUNCIL ROSTER & DISPLAY PRIORITY</p>
                <h2>Active Leaders ({team.length})</h2>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="action-btn edit-btn"
                  onClick={handleSyncLeadersFromAccounts}
                  disabled={syncing}
                  style={{ fontSize: '10px' }}
                >
                  {syncing ? 'Syncing…' : '⚡ Sync'}
                </button>
              </div>
            </div>
            <p style={{ color: '#7e95a7', fontSize: '11px', margin: '4px 0 14px' }}>
              Priority order reflects hierarchy (President → VP → Student Coordinator → Leads). Use <b>▲ Up</b> and <b>▼ Down</b> to customize order.
            </p>

            {loading ? (
              <p className="directory-state">Loading team...</p>
            ) : team.length === 0 ? (
              <p className="directory-state">No leadership profiles added yet.</p>
            ) : (
              <div className="team-grid" style={{ marginTop: '16px' }}>
                {team.map((l, idx) => (
                  <div className="leader-card" key={l.id}>
                    {/* Header with Priority Order Badge and Reorder Buttons */}
                    <div className="leader-card-header">
                      <span className="leader-order-badge">#{idx + 1} PRIORITY</span>
                      <div className="leader-order-controls">
                        <button
                          type="button"
                          className="order-btn"
                          disabled={idx === 0}
                          onClick={() => moveMember(idx, -1)}
                          title="Move Up in Priority"
                        >
                          ▲ Up
                        </button>
                        <button
                          type="button"
                          className="order-btn"
                          disabled={idx === team.length - 1}
                          onClick={() => moveMember(idx, 1)}
                          title="Move Down in Priority"
                        >
                          ▼ Down
                        </button>
                      </div>
                    </div>

                    {l.photoUrl ? (
                      <img className="leader-photo" src={l.photoUrl} alt={l.name} />
                    ) : (
                      <div className="leader-photo-placeholder">{l.name.slice(0, 2).toUpperCase()}</div>
                    )}
                    <b style={{ color: 'var(--text-main)', fontSize: '15px' }}>{l.name}</b>
                    <small style={{ color: 'var(--brand-primary)', font: '600 10px "DM Mono", monospace', margin: '4px 0' }}>{l.roleTitle}</small>
                    <p style={{ color: 'var(--text-muted)', fontSize: '11px', margin: '6px 0 12px' }}>{l.bio || 'No bio provided.'}</p>

                    <div className="leader-card-actions">
                      <button
                        type="button"
                        className="action-btn edit-btn"
                        onClick={() => {
                          setEditingMember(l)
                          setEditPhotoPreview(l.photoUrl || '')
                        }}
                      >
                        Edit Profile
                      </button>
                      <button
                        type="button"
                        className="action-btn delete-btn"
                        onClick={() => removeMember(l.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>
        </div>

        {/* Edit Leader Profile Modal */}
        {editingMember && (
          <div className="photo-lightbox" onClick={() => setEditingMember(null)}>
            <div className="guest-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '580px' }}>
              <button className="lightbox-close" onClick={() => setEditingMember(null)}>✕</button>
              <p className="eyebrow">UPDATE COUNCIL PROFILE</p>
              <h3 style={{ color: 'var(--text-main)', font: '700 20px Syne', margin: '4px 0 8px' }}>
                Edit Leader Profile: {editingMember.name}
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '11px', margin: '0 0 16px' }}>
                Changes will immediately update across the website and in the onboarding briefing slideshow.
              </p>

              <form onSubmit={handleUpdateMember}>
                <div className="member-form-grid">
                  <label>
                    Full Name *
                    <input name="name" required defaultValue={editingMember.name} />
                  </label>
                  <label>
                    Council Role Title *
                    <input name="roleTitle" required defaultValue={editingMember.roleTitle} />
                  </label>
                  <label>
                    Official Email
                    <input name="collegeEmail" type="email" defaultValue={editingMember.collegeEmail || ''} />
                  </label>
                  <label>
                    Update Photo
                    <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) readImageFile(f, setEditPhotoPreview) }} />
                  </label>
                  <label className="form-wide">
                    Short Bio
                    <input name="bio" defaultValue={editingMember.bio || ''} placeholder="Specialization & achievements..." />
                  </label>
                  <label>
                    LinkedIn URL
                    <input name="linkedinUrl" defaultValue={editingMember.linkedinUrl || ''} placeholder="https://linkedin.com/in/..." />
                  </label>
                  <label>
                    GitHub URL
                    <input name="githubUrl" defaultValue={editingMember.githubUrl || ''} placeholder="https://github.com/..." />
                  </label>
                </div>

                {editPhotoPreview && (
                  <div style={{ margin: '12px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <img src={editPhotoPreview} alt="Preview" style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #52bbf5' }} />
                    <button type="button" className="action-btn delete-btn" onClick={() => setEditPhotoPreview('')}>Remove Photo</button>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                  <button type="button" className="action-btn cancel-btn" style={{ flex: 1 }} onClick={() => setEditingMember(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="primary" style={{ flex: 2, minHeight: '40px', fontSize: '11px' }} disabled={submitting}>
                    {submitting ? 'SAVING CHANGES…' : '✓ SAVE PROFILE CHANGES'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </section>
    </LivePortal>
  )
}

// ----------------------------------------------------
// Club Settings & Priority Controls (Admin)
// ----------------------------------------------------
function ClubSettingsManager({ user, logout, onNavigate }) {
  const { platformMode, setPlatformMode, themeMode, setThemeMode, setClubSettings } = usePlatformTheme()
  const [selectedPlatform, setSelectedPlatform] = useState(platformMode || 'CYBER_SECURITY_CLUB')
  const [siteStatus, setSiteStatus] = useState('ACTIVE')
  const [subscriptionEnabled, setSubscriptionEnabled] = useState(false)
  const [subscriptionAmount, setSubscriptionAmount] = useState('100')
  const [subscriptionUpiId, setSubscriptionUpiId] = useState('')
  const [qrPreview, setQrPreview] = useState('')
  const [reelsEnabled, setReelsEnabled] = useState(true)
  const [introVideoEnabled, setIntroVideoEnabled] = useState(true)
  const [onboardingBriefingMode, setOnboardingBriefingMode] = useState('VIDEO')
  const [introVideoUrl, setIntroVideoUrl] = useState('')
  const [introVideoRequireTwoMinutes, setIntroVideoRequireTwoMinutes] = useState(true)

  // Official Contact & Technical Support Suite
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [technicalSupportEmail, setTechnicalSupportEmail] = useState('')
  const [technicalSupportPhone, setTechnicalSupportPhone] = useState('')

  // Official Social Media Channels
  const [instagramUrl, setInstagramUrl] = useState('')
  const [githubUrl, setGithubUrl] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [discordUrl, setDiscordUrl] = useState('')
  const [whatsappUrl, setWhatsappUrl] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // One-Click Full Database (.sql) Export States
  const [sqlExportModalOpen, setSqlExportModalOpen] = useState(false)
  const [sqlExportPassword, setSqlExportPassword] = useState('')
  const [sqlExportSubmitting, setSqlExportSubmitting] = useState(false)
  const [sqlExportError, setSqlExportError] = useState('')
  const [sqlExportSuccess, setSqlExportSuccess] = useState('')

  useEffect(() => {
    let mounted = true
    adminApi.getClubSettings()
      .then(({ settings: dict }) => {
        if (!mounted || !dict) return
        if (dict.platformMode) {
          setSelectedPlatform(dict.platformMode)
          setPlatformMode(dict.platformMode)
        }
        setSiteStatus(dict.siteStatus || 'ACTIVE')
        setSubscriptionEnabled(dict.subscriptionEnabled === true || dict.subscriptionEnabled === 'true')
        setSubscriptionAmount(String(dict.subscriptionMonthlyAmount || '100'))
        setSubscriptionUpiId(dict.subscriptionUpiId || '')
        setQrPreview(dict.subscriptionQrUrl || '')
        setReelsEnabled(dict.reelsEnabled !== false && dict.reelsEnabled !== 'false')
        setIntroVideoEnabled(dict.introVideoEnabled !== false && dict.introVideoEnabled !== 'false')
        setOnboardingBriefingMode(dict.onboardingBriefingMode || dict.introBriefingMode || 'VIDEO')
        setIntroVideoUrl(dict.introVideoUrl || '')
        setIntroVideoRequireTwoMinutes(dict.introVideoRequireTwoMinutes !== false && dict.introVideoRequireTwoMinutes !== 'false')

        setContactEmail(dict.contactEmail || '')
        setContactPhone(dict.contactPhone || '')
        setTechnicalSupportEmail(dict.technicalSupportEmail || '')
        setTechnicalSupportPhone(dict.technicalSupportPhone || '')

        setInstagramUrl(dict.instagramUrl || '')
        setGithubUrl(dict.githubUrl || '')
        setLinkedinUrl(dict.linkedinUrl || '')
        setYoutubeUrl(dict.youtubeUrl || '')
        setDiscordUrl(dict.discordUrl || '')
        setWhatsappUrl(dict.whatsappUrl || '')
        setWebsiteUrl(dict.websiteUrl || '')
      })
      .catch(err => { if (mounted) setError(err.message) })
    return () => { mounted = false }
  }, [setPlatformMode])

  async function handleSaveSettings(e) {
    e.preventDefault()
    setMessage('')
    setError('')

    const payload = {
      platformMode: selectedPlatform,
      siteStatus,
      subscriptionEnabled,
      subscriptionMonthlyAmount: subscriptionAmount ? Number(subscriptionAmount) : 100,
      subscriptionUpiId: subscriptionUpiId.trim() || null,
      subscriptionQrUrl: qrPreview || null,
      reelsEnabled,
      introVideoEnabled,
      onboardingBriefingMode,
      introBriefingMode: onboardingBriefingMode,
      introVideoUrl: introVideoUrl.trim() || null,
      introVideoRequireTwoMinutes,
      contactEmail: contactEmail.trim() || null,
      contactPhone: contactPhone.trim() || null,
      technicalSupportEmail: technicalSupportEmail.trim() || null,
      technicalSupportPhone: technicalSupportPhone.trim() || null,
      instagramUrl: instagramUrl.trim() || null,
      githubUrl: githubUrl.trim() || null,
      linkedinUrl: linkedinUrl.trim() || null,
      youtubeUrl: youtubeUrl.trim() || null,
      discordUrl: discordUrl.trim() || null,
      whatsappUrl: whatsappUrl.trim() || null,
      websiteUrl: websiteUrl.trim() || null,
    }

    setSubmitting(true)
    try {
      const { settings: updated } = await adminApi.updateClubSettings(payload)
      setPlatformMode(selectedPlatform)
      if (setClubSettings) setClubSettings(updated || payload)
      try {
        localStorage.setItem('cached_club_settings', JSON.stringify(updated || payload))
      } catch (e) {}
      setMessage('✓ Platform settings, social media, and technical support channels saved successfully.')
    } catch (err) {
      setError(err.message || 'Failed to update settings.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleExecuteSqlExport(e) {
    e.preventDefault()
    setSqlExportError('')
    setSqlExportSuccess('')
    if (!sqlExportPassword) {
      setSqlExportError('Please enter your account password.')
      return
    }

    setSqlExportSubmitting(true)
    try {
      const res = await adminApi.exportDatabaseSql(sqlExportPassword)
      const blob = new Blob([res.sqlContent], { type: 'application/sql;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = res.filename || `mrdu_csc_full_database_backup_${Date.now()}.sql`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      setSqlExportSuccess(`✓ Full database export (${(res.sqlContent.length / 1024).toFixed(1)} KB) generated and downloaded successfully!`)
      setSqlExportPassword('')
      setTimeout(() => {
        setSqlExportModalOpen(false)
        setSqlExportSuccess('')
      }, 2500)
    } catch (err) {
      setSqlExportError(err.message || 'Failed to export database.')
    } finally {
      setSqlExportSubmitting(false)
    }
  }

  return (
    <LivePortal user={user} logout={logout} activeTab="admin-settings" onNavigate={onNavigate} title={selectedPlatform === 'MRDU_EVENTS' ? 'PORTAL SETTINGS' : 'CLUB SETTINGS'}>
      <section className="member-management">
        <div className="member-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate('admin-dashboard')}>
              ← COMMAND CENTER
            </button>
            <p className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Icon8 name="keySecurity" size={14} /> CENTRAL CONFIGURATION & BRANDING
            </p>
            <h1>Global Controls & Platform Identity</h1>
            <p>Configure platform modes, interface themes, site availability, official social media, and technical support helpdesk.</p>
          </div>
          {user.isPrimaryAdmin && (
            <span className="president-lock" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <IconCrown size={13} /> PRIMARY PRESIDENT CONTROLS
            </span>
          )}
        </div>

        {message && <p className="member-form-success">{message}</p>}
        {error && <p className="member-form-error">{error}</p>}

        {/* Card: Full Database Backup (.SQL One-Click Export) */}
        {user.isPrimaryAdmin && (
          <article className="settings-section-card" style={{ border: '1px solid rgba(234, 88, 12, 0.35)', background: 'linear-gradient(180deg, rgba(234, 88, 12, 0.05) 0%, var(--bg-card) 100%)', marginBottom: '24px' }}>
            <div className="settings-card-header">
              <div>
                <p className="eyebrow" style={{ color: '#ea580c' }}>DISASTER RECOVERY & ARCHIVAL</p>
                <h3 style={{ color: 'var(--text-main)' }}>Full Database Backup (.SQL One-Click Export)</h3>
              </div>
              <span className="platform-active-pill" style={{ background: '#fff7ed', color: '#ea580c', borderColor: 'rgba(234, 88, 12, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <IconCrown size={13} /> PRIMARY PRESIDENT SECURE TOOL
              </span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.6', margin: '0 0 16px' }}>
              Download a complete, unencrypted <b>.SQL database dump</b> containing all 19 system tables (all members, accounts, profiles, events, registrations, settings, gallery, complaints, support tickets, and audit records). The downloaded file can be imported directly into any MySQL database with a single click.
            </p>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="primary"
                onClick={() => {
                  setSqlExportPassword('')
                  setSqlExportError('')
                  setSqlExportSuccess('')
                  setSqlExportModalOpen(true)
                }}
                style={{
                  background: 'linear-gradient(135deg, #ea580c, #c2410c)',
                  borderColor: '#ea580c',
                  color: '#ffffff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  fontWeight: 700,
                  fontSize: '12px',
                  borderRadius: '8px',
                }}
              >
                <IconDownload size={15} /> DOWNLOAD ALL WEBSITE DATA (.SQL)
              </button>
              <small style={{ color: 'var(--text-dim)', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Icon8 name="keySecurity" size={13} /> Requires Primary President account password for authorization
              </small>
            </div>
          </article>
        )}

        <form onSubmit={handleSaveSettings}>
          {/* Card 0: Platform Identity & Mode (Primary Admin Switcher) */}
          <article className="settings-section-card" style={{ border: '1px solid var(--brand-border-subtle)', background: 'var(--bg-card)' }}>
            <div className="settings-card-header">
              <div>
                <p className="eyebrow" style={{ color: 'var(--brand-eyebrow)' }}>PLATFORM IDENTITY & BRANDING</p>
                <h3 style={{ color: 'var(--text-main)' }}>Platform Mode Switcher (Primary Admin)</h3>
              </div>
              <span className="platform-active-pill">
                ACTIVE: {selectedPlatform === 'MRDU_EVENTS' ? 'MRDU EVENTS' : 'CYBER SECURITY CLUB'}
              </span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.6', margin: '0 0 16px' }}>
              Switch the complete website and portal identity between <b>Cyber Security Club</b> and <b>MRDU Events</b>. All features, data, events, registrations, and admin controls remain 100% active and identical across both modes.
            </p>

            <div className="platform-mode-switcher-grid">
              <button
                type="button"
                className={`platform-mode-card ${selectedPlatform === 'CYBER_SECURITY_CLUB' ? 'active' : ''}`}
                onClick={() => {
                  if (!user.isPrimaryAdmin) return
                  setSelectedPlatform('CYBER_SECURITY_CLUB')
                  setPlatformMode('CYBER_SECURITY_CLUB')
                }}
                disabled={!user.isPrimaryAdmin}
              >
                <div className="platform-mode-card-header">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                    <IconShieldCheck size={16} /> Cyber Security Club
                  </span>
                  {selectedPlatform === 'CYBER_SECURITY_CLUB' && <span className="platform-active-pill">SELECTED</span>}
                </div>
                <p>
                  Official Cyber Security Club identity. Uses cyber defense crest, dark neon cyan accents, CTF sandbox references, and cybersecurity department themes.
                </p>
              </button>

              <button
                type="button"
                className={`platform-mode-card ${selectedPlatform === 'MRDU_EVENTS' ? 'active' : ''}`}
                onClick={() => {
                  if (!user.isPrimaryAdmin) return
                  setSelectedPlatform('MRDU_EVENTS')
                  setPlatformMode('MRDU_EVENTS')
                }}
                disabled={!user.isPrimaryAdmin}
              >
                <div className="platform-mode-card-header">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                    <IconSparkles size={16} /> MRDU Events Portal
                  </span>
                  {selectedPlatform === 'MRDU_EVENTS' && <span className="platform-active-pill">SELECTED</span>}
                </div>
                <p>
                  Official Malla Reddy University Events identity. Uses official university banner/crest, academic garnet & gold accents, and multi-department event hub themes.
                </p>
              </button>
            </div>
          </article>

          {/* Card 1: Site Status (Hibernation Mode) */}
          <article className="settings-section-card">
            <div className="settings-card-header">
              <div>
                <p className="eyebrow" style={{ color: '#ffb74d' }}>SYSTEM AVAILABILITY</p>
                <h3>Site Status & Hibernation Mode</h3>
              </div>
              <div className="toggle-switch-container">
                <button
                  type="button"
                  className={`switch-btn ${siteStatus === 'ACTIVE' ? 'on' : ''}`}
                  onClick={() => setSiteStatus('ACTIVE')}
                  disabled={!user.isPrimaryAdmin}
                >
                  ONLINE / ACTIVE
                </button>
                <button
                  type="button"
                  className={`switch-btn ${siteStatus === 'HIBERNATING' ? 'off' : ''}`}
                  onClick={() => setSiteStatus('HIBERNATING')}
                  disabled={!user.isPrimaryAdmin}
                >
                  HIBERNATION / OFF
                </button>
              </div>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.6', margin: 0 }}>
              {siteStatus === 'ACTIVE'
                ? 'Website Active: Public visitors and students have normal uninterrupted access.'
                : 'Hibernation Active: Public visitors and students see the dedicated Hibernation countdown screen. Only the Primary President and Admins can log in.'}
            </p>
          </article>

          {/* Card 2: Membership Subscription System */}
          <article className="settings-section-card">
            <div className="settings-card-header">
              <div>
                <p className="eyebrow" style={{ color: '#70ddb4' }}>MEMBERSHIP FEE</p>
                <h3>Student Membership Subscription System</h3>
              </div>
              <div className="toggle-switch-container">
                <button
                  type="button"
                  className={`switch-btn ${subscriptionEnabled ? 'on' : ''}`}
                  onClick={() => setSubscriptionEnabled(true)}
                  disabled={!user.isPrimaryAdmin}
                >
                  ENABLED
                </button>
                <button
                  type="button"
                  className={`switch-btn ${!subscriptionEnabled ? 'off' : ''}`}
                  onClick={() => setSubscriptionEnabled(false)}
                  disabled={!user.isPrimaryAdmin}
                >
                  DISABLED
                </button>
              </div>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.6', margin: '0 0 16px' }}>
              {subscriptionEnabled
                ? 'When ENABLED: Students must have an active verified subscription via UPI to register for events and access technical support.'
                : 'When DISABLED: All students enjoy free access without subscription requirements. Payment history remains preserved.'}
            </p>

            <div className="member-form-grid">
              <label>
                Monthly Subscription Amount (₹)
                <input
                  type="number"
                  value={subscriptionAmount}
                  onChange={e => setSubscriptionAmount(e.target.value)}
                  placeholder="100"
                  disabled={!user.isPrimaryAdmin}
                />
              </label>
              <label>
                Club UPI ID for Subscriptions
                <input
                  value={subscriptionUpiId}
                  onChange={e => setSubscriptionUpiId(e.target.value)}
                  placeholder="club@okaxis"
                  disabled={!user.isPrimaryAdmin}
                />
              </label>
              <label className="form-wide">
                Upload Club Payment QR Code Image
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => { const f = e.target.files?.[0]; if (f) readImageFile(f, setQrPreview) }}
                  disabled={!user.isPrimaryAdmin}
                />
              </label>
            </div>

            {qrPreview && (
              <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <img src={qrPreview} alt="Subscription QR" style={{ height: '80px', borderRadius: '6px', border: '1px solid #52bbf544' }} />
                <button type="button" className="action-btn delete-btn" onClick={() => setQrPreview('')} disabled={!user.isPrimaryAdmin}>
                  <IconTrash size={13} /> Remove QR Code
                </button>
              </div>
            )}
          </article>

          {/* Card 2b: Campus Reels & Instagram Section Toggle */}
          <article className="settings-section-card">
            <div className="settings-card-header">
              <div>
                <p className="eyebrow" style={{ color: 'var(--brand-primary)' }}>CAMPUS MEDIA SECTION</p>
                <h3>Campus Reels &amp; Instagram Feed</h3>
              </div>
              <div className="toggle-switch-container">
                <button
                  type="button"
                  className={`switch-btn ${reelsEnabled ? 'on' : ''}`}
                  onClick={() => setReelsEnabled(true)}
                  disabled={!user.isPrimaryAdmin}
                >
                  ENABLED
                </button>
                <button
                  type="button"
                  className={`switch-btn ${!reelsEnabled ? 'off' : ''}`}
                  onClick={() => setReelsEnabled(false)}
                  disabled={!user.isPrimaryAdmin}
                >
                  DISABLED
                </button>
              </div>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.6', margin: '0 0 16px' }}>
              {reelsEnabled
                ? 'ENABLED: The Campus Reels & Instagram section is visible in student accounts. Students can browse and view reels published by the admin team.'
                : 'DISABLED: The Campus Reels section is hidden from all student accounts. Existing reels are preserved and will reappear when re-enabled.'}
            </p>
            {!reelsEnabled && (
              <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', color: '#fca5a5', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <IconAlertTriangle size={14} />
                Reels section will be hidden from student sidebar and home dashboard.
              </div>
            )}
          </article>

          {/* Card 3: Student Onboarding Video */}
          <article className="settings-section-card">
            <div className="settings-card-header">
              <div>
                <p className="eyebrow" style={{ color: '#85d7ff' }}>MANDATORY STUDENT ONBOARDING</p>
                <h3>2-Minute YouTube Orientation Video</h3>
              </div>
              <div className="toggle-switch-container">
                <button
                  type="button"
                  className={`switch-btn ${introVideoEnabled ? 'on' : ''}`}
                  onClick={() => setIntroVideoEnabled(true)}
                  disabled={!user.isPrimaryAdmin}
                >
                  ENABLED
                </button>
                <button
                  type="button"
                  className={`switch-btn ${!introVideoEnabled ? 'off' : ''}`}
                  onClick={() => setIntroVideoEnabled(false)}
                  disabled={!user.isPrimaryAdmin}
                >
                  DISABLED
                </button>
              </div>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.6', margin: '0 0 16px' }}>
              {introVideoEnabled
                ? 'ENABLED: Newly logged-in students must watch the mandatory 2-minute YouTube orientation video before gaining access to the portal dashboard.'
                : 'DISABLED: Students bypass the orientation video and proceed directly to their dashboard.'}
            </p>

            <div style={{ background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '10px', padding: '16px' }}>
              <div className="member-form-grid">
                <label className="form-wide">
                  <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600 }}>YouTube Onboarding Video URL</span>
                    {parseYouTubeVideoId(introVideoUrl || 'https://www.youtube.com/watch?v=gokPW83s7nA') ? (
                      <span style={{ color: '#70ddb4', fontSize: '11px', fontWeight: 600 }}>
                        ✓ Detected ID: <code>{parseYouTubeVideoId(introVideoUrl || 'https://www.youtube.com/watch?v=gokPW83s7nA')}</code>
                      </span>
                    ) : introVideoUrl ? (
                      <span style={{ color: '#f87171', fontSize: '11px', fontWeight: 600 }}>
                        Invalid YouTube URL
                      </span>
                    ) : null}
                  </span>
                  <input
                    value={introVideoUrl}
                    onChange={e => setIntroVideoUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=gokPW83s7nA"
                    disabled={!user.isPrimaryAdmin}
                    style={{ marginTop: '6px' }}
                  />
                </label>
              </div>

              {parseYouTubeVideoId(introVideoUrl || 'https://www.youtube.com/watch?v=gokPW83s7nA') && (
                <div style={{ marginTop: '14px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--brand-border-subtle)', background: '#000' }}>
                  <iframe
                    src={`https://www.youtube.com/embed/${parseYouTubeVideoId(introVideoUrl || 'https://www.youtube.com/watch?v=gokPW83s7nA')}?controls=1&rel=0&modestbranding=1`}
                    title="Orientation Video Preview"
                    style={{ width: '100%', height: '240px', border: 0, display: 'block' }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              )}
            </div>
          </article>

          {/* Card 4: Official Club Communications & Technical Support */}
          <article className="settings-section-card">
            <div className="settings-card-header">
              <div>
                <p className="eyebrow" style={{ color: 'var(--brand-primary)' }}>COMMUNICATIONS & SUPPORT SUITE</p>
                <h3>Official Club Contact & Technical Support</h3>
              </div>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.6', margin: '0 0 16px' }}>
              Publish official club contacts and dedicated technical support helpdesk channels. These links and emails will be displayed on student dashboards and support desk.
            </p>

            <div className="member-form-grid">
              <label>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <IconMail size={14} /> Official Club Email ID
                </span>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={e => setContactEmail(e.target.value)}
                  placeholder="cybersecurityclub@mrdu.edu"
                />
              </label>
              <label>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Icon8 name="idDocs" size={14} /> Club Office / Contact Phone
                </span>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={e => setContactPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                />
              </label>
              <label>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <IconHeadset size={14} /> Dedicated Technical Support Email
                </span>
                <input
                  type="email"
                  value={technicalSupportEmail}
                  onChange={e => setTechnicalSupportEmail(e.target.value)}
                  placeholder="techsupport@mrdu.edu"
                />
              </label>
              <label>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <IconWhatsApp size={14} /> Technical Support Helpline / WhatsApp
                </span>
                <input
                  type="tel"
                  value={technicalSupportPhone}
                  onChange={e => setTechnicalSupportPhone(e.target.value)}
                  placeholder="+91 98765 01234"
                />
              </label>
            </div>
          </article>

          {/* Card 5: Official Social Media & Community Channels */}
          <article className="settings-section-card">
            <div className="settings-card-header">
              <div>
                <p className="eyebrow" style={{ color: '#ec4899' }}>BRANDING & SOCIAL CHANNELS</p>
                <h3>Official Social Media & Communities</h3>
              </div>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.6', margin: '0 0 16px' }}>
              Publish all official club social handles and online platforms. Students can 1-click navigate directly from their student dashboard.
            </p>

            <div className="member-form-grid">
              <label>
                <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <IconInstagram size={14} /> Instagram Profile URL
                  </span>
                  {instagramUrl && (
                    <a href={instagramUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-primary)', fontSize: '11px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      Test <IconExternalLink size={11} />
                    </a>
                  )}
                </span>
                <input
                  value={instagramUrl}
                  onChange={e => setInstagramUrl(e.target.value)}
                  placeholder="https://instagram.com/mrdu_cybersecurity"
                />
              </label>

              <label>
                <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <IconYouTube size={14} /> YouTube Channel URL
                  </span>
                  {youtubeUrl && (
                    <a href={youtubeUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-primary)', fontSize: '11px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      Test <IconExternalLink size={11} />
                    </a>
                  )}
                </span>
                <input
                  value={youtubeUrl}
                  onChange={e => setYoutubeUrl(e.target.value)}
                  placeholder="https://youtube.com/@mrdu_csc"
                />
              </label>

              <label>
                <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <IconLinkedIn size={14} /> LinkedIn Page URL
                  </span>
                  {linkedinUrl && (
                    <a href={linkedinUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-primary)', fontSize: '11px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      Test <IconExternalLink size={11} />
                    </a>
                  )}
                </span>
                <input
                  value={linkedinUrl}
                  onChange={e => setLinkedinUrl(e.target.value)}
                  placeholder="https://linkedin.com/company/mrdu-csc"
                />
              </label>

              <label>
                <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <IconGitHub size={14} /> GitHub Organization URL
                  </span>
                  {githubUrl && (
                    <a href={githubUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-primary)', fontSize: '11px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      Test <IconExternalLink size={11} />
                    </a>
                  )}
                </span>
                <input
                  value={githubUrl}
                  onChange={e => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/mrdu-csc"
                />
              </label>

              <label>
                <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <IconDiscord size={14} /> Discord Server Invite
                  </span>
                  {discordUrl && (
                    <a href={discordUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-primary)', fontSize: '11px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      Test <IconExternalLink size={11} />
                    </a>
                  )}
                </span>
                <input
                  value={discordUrl}
                  onChange={e => setDiscordUrl(e.target.value)}
                  placeholder="https://discord.gg/invite_code"
                />
              </label>

              <label>
                <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <IconWhatsApp size={14} /> WhatsApp Community / Group
                  </span>
                  {whatsappUrl && (
                    <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-primary)', fontSize: '11px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      Test <IconExternalLink size={11} />
                    </a>
                  )}
                </span>
                <input
                  value={whatsappUrl}
                  onChange={e => setWhatsappUrl(e.target.value)}
                  placeholder="https://chat.whatsapp.com/invite_code"
                />
              </label>

              <label className="form-wide">
                <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <IconGlobe size={14} /> Official Website / Portal URL
                  </span>
                  {websiteUrl && (
                    <a href={websiteUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-primary)', fontSize: '11px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      Test <IconExternalLink size={11} />
                    </a>
                  )}
                </span>
                <input
                  value={websiteUrl}
                  onChange={e => setWebsiteUrl(e.target.value)}
                  placeholder="https://cybersecurity.mrdu.edu"
                />
              </label>
            </div>
          </article>

          <button className="primary member-submit" type="submit" disabled={submitting} style={{ minHeight: '46px', width: '100%', fontSize: '13px', fontWeight: 700, letterSpacing: '0.04em' }}>
            {submitting ? 'SAVING CONFIGURATION…' : 'SAVE ALL SETTINGS & PUBLISH'}
          </button>
        </form>

        {/* Modal for SQL Export Password Confirmation */}
        {sqlExportModalOpen && (
          <div
            className="modal-backdrop"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(7, 22, 44, 0.85)',
              backdropFilter: 'blur(8px)',
              zIndex: 1100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
            }}
            onClick={() => setSqlExportModalOpen(false)}
          >
            <div
              className="modal-card"
              style={{
                maxWidth: '460px',
                width: '100%',
                background: 'var(--bg-modal, #0b1522)',
                border: '1px solid rgba(234, 88, 12, 0.4)',
                borderRadius: '16px',
                padding: '28px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <span style={{ display: 'inline-flex', padding: '12px', borderRadius: '50%', background: 'rgba(234, 88, 12, 0.12)', color: '#ea580c', marginBottom: '12px' }}>
                  <IconCrown size={28} />
                </span>
                <h3 style={{ margin: '0 0 6px', color: 'var(--text-main)', fontSize: '20px', fontWeight: 700 }}>
                  Primary President Verification
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Enter your Primary President account password to authorize and generate the full <b>.SQL database dump</b>.
                </p>
              </div>

              {sqlExportError && (
                <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#450a0a', border: '1px solid #f87171', color: '#fca5a5', fontSize: '12px', marginBottom: '16px' }}>
                  {sqlExportError}
                </div>
              )}

              {sqlExportSuccess && (
                <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#052e16', border: '1px solid #4ade80', color: '#86efac', fontSize: '12px', marginBottom: '16px' }}>
                  {sqlExportSuccess}
                </div>
              )}

              <form onSubmit={handleExecuteSqlExport}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                  Account Password *
                  <input
                    type="password"
                    required
                    placeholder="Enter your account password"
                    value={sqlExportPassword}
                    onChange={e => setSqlExportPassword(e.target.value)}
                    style={{ width: '100%', height: '42px', padding: '0 14px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)', marginTop: '4px' }}
                    autoFocus
                  />
                </label>

                <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                  <button
                    type="button"
                    className="outline"
                    onClick={() => setSqlExportModalOpen(false)}
                    style={{ flex: 1, height: '42px' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="primary"
                    disabled={sqlExportSubmitting || !sqlExportPassword}
                    style={{ flex: 2, height: '42px', background: 'linear-gradient(135deg, #ea580c, #c2410c)', borderColor: '#ea580c' }}
                  >
                    {sqlExportSubmitting ? 'GENERATING SQL...' : 'CONFIRM & EXPORT'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </section>
    </LivePortal>
  )
}

// ----------------------------------------------------
// Student Events Catalog
// ----------------------------------------------------
function StudentEvents({ user, logout, onNavigate }) {
  const { platformMode } = usePlatformTheme()
  const isMrdu = platformMode === 'MRDU_EVENTS'
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    memberApi.listEvents()
      .then(({ events: list }) => { if (mounted) setEvents(list || []) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  return (
    <LivePortal user={user} logout={logout} activeTab="student-events" onNavigate={onNavigate} title={isMrdu ? 'MRDU EVENTS CATALOG' : 'EVENTS CATALOG'}>
      <section className="gallery-section">
        <div className="event-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate('student-dashboard')}>
              ← BACK TO DASHBOARD
            </button>
            <p className="eyebrow">{isMrdu ? 'MRDU UNIVERSITY CALENDAR' : 'COMMUNITY CALENDAR'}</p>
            <h1>{isMrdu ? 'University Events & Fests' : 'Upcoming Club Events'}</h1>
            <p>{isMrdu ? 'Register for university-wide technical symposiums, hackathons, cultural fests, and workshops.' : 'Participate in defensive workshops, certification bootcamps, and CTF challenges.'}</p>
          </div>
        </div>

        {loading ? (
          <p className="directory-state">Loading events catalog...</p>
        ) : events.length === 0 ? (
          <p className="directory-state">No upcoming events currently published. Check back soon!</p>
        ) : (
          <div className="student-events-container">
            {events.map(evt => (
              <article key={evt.id} className="live-event-card">
                <div className="event-banner">
                  {evt.photoUrl ? (
                    <img src={evt.photoUrl} alt={evt.title} />
                  ) : (
                    <div className="event-banner-fallback">
                      <strong>{evt.eventType.toUpperCase()}</strong>
                    </div>
                  )}
                  <span className="event-badge-overlay">{evt.eventType}</span>
                </div>
                <div className="card-content">
                  <h3>{evt.title}</h3>
                  <p>{evt.shortDescription || evt.description || (isMrdu ? 'MRDU University official event session.' : 'Department of Cyber Security session.')}</p>
                  <div className="card-meta">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><IconCalendar size={13} /> {new Date(evt.dateTime).toLocaleDateString()}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><IconLocationPin size={13} /> {evt.venue || evt.location || 'Campus'}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><IconCreditCard size={13} /> {evt.requiresPayment ? `₹${evt.paymentAmount || 'Tiered'}` : 'FREE'}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><IconUserSvg size={13} /> {evt.registrationCount || 0} registered</span>
                  </div>
                  <div className="card-footer">
                    {evt.isRegistered ? (
                      <span className="badge badge-registered" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Icon8 name="authentication" size={12} /> REGISTERED
                      </span>
                    ) : (
                      <button className="register-btn" type="button" onClick={() => onNavigate(`event-detail/${evt.id}`)}>
                        VIEW DETAILS & REGISTER &rarr;
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </LivePortal>
  )
}

// ----------------------------------------------------
// Student Registrations & Passes
// ----------------------------------------------------
function StudentRegistrations({ user, logout, onNavigate }) {
  const { platformMode } = usePlatformTheme()
  const isMrdu = platformMode === 'MRDU_EVENTS'
  const cacheKey = `csc_passes_cache_${user?.id || 'guest'}`
  const [isOfflineCached, setIsOfflineCached] = useState(false)
  const [registrations, setRegistrations] = useState(() => {
    try {
      const cached = localStorage.getItem(cacheKey)
      if (cached) return JSON.parse(cached)
    } catch {}
    return []
  })
  const [loading, setLoading] = useState(() => {
    try {
      const cached = localStorage.getItem(cacheKey)
      return !cached || JSON.parse(cached).length === 0
    } catch {
      return true
    }
  })
  const [selectedPass, setSelectedPass] = useState(null)
  const [copiedId, setCopiedId] = useState(false)

  useEffect(() => {
    let mounted = true
    memberApi.listRegistrations()
      .then(({ registrations: list }) => {
        if (!mounted) return
        const regList = list || []
        setRegistrations(regList)
        setIsOfflineCached(false)
        try {
          localStorage.setItem(cacheKey, JSON.stringify(regList))
        } catch {}
        const params = new URLSearchParams(window.location.search)
        const targetId = params.get('passId') || params.get('id')
        if (targetId) {
          const match = regList.find(p => p.id === targetId || p.event?.id === targetId)
          if (match) setSelectedPass(match)
        }
      })
      .catch(() => {
        if (!mounted) return
        try {
          const cached = localStorage.getItem(cacheKey)
          if (cached && JSON.parse(cached).length > 0) {
            setIsOfflineCached(true)
            return
          }
        } catch {}
        setRegistrations([])
      })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [cacheKey])

  function handleCopyPassId(id) {
    if (!id) return
    navigator.clipboard?.writeText(id).then(() => {
      setCopiedId(true)
      setTimeout(() => setCopiedId(false), 2200)
    }).catch(() => {})
  }

  return (
    <LivePortal user={user} logout={logout} activeTab="student-passes" onNavigate={onNavigate} title={isMrdu ? 'MY MRDU EVENT PASSES' : 'MY EVENT PASSES'}>
      <section className="gallery-section">
        <div className="event-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate('student-dashboard')}>
              ← BACK TO DASHBOARD
            </button>
            <p className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Icon8 name="idDocs" size={14} /> {isMrdu ? 'CONFIRMED PASSES & BADGES' : 'CONFIRMED PASSES'}
            </p>
            <h1>{isMrdu ? 'My Event Passes & QR Badges' : 'My Event Passes & QR'}</h1>
            <p>{isMrdu ? 'Your confirmed attendance passes and digital entrance verification for all MRDU events.' : 'Your confirmed attendance records and entry passes for all club sessions.'}</p>
          </div>
        </div>

        {isOfflineCached && (
          <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid #10b981', borderRadius: '10px', padding: '10px 16px', margin: '16px 0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#10b981' }}>
            <span>⚡</span>
            <span><strong>Offline / Low-Network Mode:</strong> Your event passes and entrance QR codes are safely loaded from device cache. They can be scanned at the venue gate even without internet.</span>
          </div>
        )}

        {loading ? (
          <p className="directory-state">Loading your passes...</p>
        ) : registrations.length === 0 ? (
          <p className="directory-state">You have not registered for any events yet.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: '20px', marginTop: '20px' }}>
            {registrations.map(reg => (
              <article
                key={reg.id}
                className="live-event-card"
                style={{
                  background: 'var(--bg-card)',
                  border: reg.attendanceMarked ? '1px solid #10b98166' : '1px solid var(--brand-border-subtle)',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: reg.attendanceMarked ? '0 8px 30px rgba(16, 185, 129, 0.12)' : '0 8px 30px rgba(0,0,0,0.2)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}
              >
                {/* Event Top Badge */}
                <div style={{ padding: '16px 20px', background: reg.attendanceMarked ? 'rgba(16, 185, 129, 0.12)' : 'var(--panel-subtle)', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span className="badge" style={{ background: 'var(--brand-badge-bg)', color: 'var(--brand-badge-color)', fontSize: '10px' }}>
                      {reg.event?.eventType || 'EVENT PASS'}
                    </span>
                  </div>
                  {reg.attendanceMarked ? (
                    <span className="badge" style={{ background: '#064e3b', color: '#6ee7b7', border: '1px solid #10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Icon8 name="authentication" size={14} /> ATTENDANCE CONFIRMED
                    </span>
                  ) : (
                    <span className="badge badge-registered" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Icon8 name="faceId" size={14} /> ENTRY VALID · SCAN AT GATE
                    </span>
                  )}
                </div>

                <div className="card-content" style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ margin: '0 0 8px', font: '700 18px Syne', color: 'var(--text-main)' }}>
                    {reg.event?.title || (isMrdu ? 'MRDU Event' : 'Club Event')}
                  </h3>

                  <div className="card-meta" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', margin: '12px 0 16px', fontSize: '11px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><IconCalendar size={13} /> {reg.event?.dateTime ? new Date(reg.event.dateTime).toLocaleDateString() : 'TBA'}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><IconLocationPin size={13} /> {reg.event?.venue || reg.event?.location || 'Campus'}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><IconCreditCard size={13} /> Payment: <b style={{ color: '#70ddb4', marginLeft: 4 }}>{reg.paymentStatus}</b></span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><IconUserSvg size={13} /> Attendee: {user.memberId}</span>
                  </div>

                  {/* QR Code Pass Box */}
                  <div
                    style={{
                      marginTop: 'auto',
                      padding: '16px',
                      borderRadius: '12px',
                      background: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      color: '#000000',
                      boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
                    }}
                  >
                    {reg.qrCodeData ? (
                      <img
                        src={reg.qrCodeData}
                        alt={`QR Pass for ${reg.event?.title}`}
                        onClick={() => setSelectedPass(reg)}
                        style={{ width: '96px', height: '96px', borderRadius: '8px', border: '1px solid #e2e8f0', flexShrink: 0, imageRendering: 'pixelated', cursor: 'pointer' }}
                        title="Click to view full pass"
                      />
                    ) : (
                      <div style={{ width: '96px', height: '96px', background: '#f1f5f9', display: 'grid', placeItems: 'center', borderRadius: '8px', fontSize: '10px', color: '#64748b' }}>
                        QR PASS
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, font: '700 12px Syne', color: '#0f172a' }}>
                        OFFICIAL ENTRANCE QR PASS
                      </p>
                      <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#64748b', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                        PASS ID: {reg.id.slice(0, 16)}...
                      </p>
                      <p style={{ margin: '6px 0 0', fontSize: '10px', color: reg.attendanceMarked ? '#059669' : '#d97706', fontWeight: 600 }}>
                        {reg.attendanceMarked
                          ? `✓ Checked in at ${reg.attendedAt ? new Date(reg.attendedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Gate'}`
                          : 'Show this QR to coordinator at gate'}
                      </p>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="primary"
                          onClick={() => setSelectedPass(reg)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '5px 10px',
                            height: '28px',
                            background: '#0284c7',
                            borderColor: '#0284c7',
                          }}
                        >
                          <Icon8 name="idDocs" size={13} /> VIEW FULL PASS
                        </button>
                        {reg.qrCodeData && (
                          <a
                            href={reg.qrCodeData}
                            download={`event-pass-${reg.event?.title || 'ticket'}.png`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '10px',
                              fontWeight: 700,
                              color: '#0f172a',
                              background: '#f1f5f9',
                              padding: '5px 10px',
                              borderRadius: '6px',
                              textDecoration: 'none',
                              border: '1px solid #cbd5e1',
                              height: '28px',
                              boxSizing: 'border-box',
                            }}
                          >
                            <IconDownload size={12} /> DOWNLOAD
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* FULL DIGITAL PASS MODAL / LIGHTBOX */}
        {selectedPass && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.82)',
              backdropFilter: 'blur(10px)',
              zIndex: 9999,
              display: 'grid',
              placeItems: 'center',
              padding: '20px',
              overflowY: 'auto',
            }}
            onClick={() => setSelectedPass(null)}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '520px',
                background: 'var(--bg-card)',
                borderRadius: '20px',
                border: '2px solid var(--brand-primary)',
                boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
                overflow: 'hidden',
                position: 'relative',
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Top Banner */}
              <div
                style={{
                  padding: '20px 24px',
                  background: selectedPass.attendanceMarked ? 'linear-gradient(135deg, #064e3b, #047857)' : 'linear-gradient(135deg, #0f2744, #1e3a8a)',
                  color: '#ffffff',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <span className="badge" style={{ background: 'rgba(255,255,255,0.2)', color: '#ffffff', fontSize: '10px', textTransform: 'uppercase' }}>
                    {selectedPass.event?.eventType || 'OFFICIAL EVENT PASS'}
                  </span>
                  <h2 style={{ margin: '6px 0 0', font: '700 20px Syne', color: '#ffffff' }}>
                    {selectedPass.event?.title}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPass(null)}
                  style={{
                    background: 'rgba(255,255,255,0.15)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '36px',
                    height: '36px',
                    color: '#ffffff',
                    fontSize: '18px',
                    cursor: 'pointer',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                  title="Close Pass"
                >
                  ✕
                </button>
              </div>

              <div style={{ padding: '24px' }}>
                {/* Large Center QR Pass */}
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                  <div
                    style={{
                      display: 'inline-block',
                      padding: '16px',
                      background: '#ffffff',
                      borderRadius: '16px',
                      boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
                      border: '2px solid #e2e8f0',
                    }}
                  >
                    {selectedPass.qrCodeData ? (
                      <img
                        src={selectedPass.qrCodeData}
                        alt="Event QR Code"
                        style={{ width: '200px', height: '200px', display: 'block', imageRendering: 'pixelated' }}
                      />
                    ) : (
                      <div style={{ width: '200px', height: '200px', background: '#f1f5f9', display: 'grid', placeItems: 'center', color: '#64748b' }}>
                        QR PASS
                      </div>
                    )}
                  </div>
                  <p style={{ margin: '10px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                    Hold this QR code up to the coordinator's scanner at the event entrance
                  </p>
                </div>

                {/* Full Pass ID Box */}
                <div style={{ padding: '14px', background: 'var(--bg-input)', borderRadius: '12px', border: '1px solid var(--line)', marginBottom: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <small style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      FULL PASS ID & VERIFICATION KEY
                    </small>
                    <button
                      type="button"
                      className="outline"
                      onClick={() => handleCopyPassId(selectedPass.id)}
                      style={{ fontSize: '10px', padding: '3px 8px', height: '24px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <IconCopy size={11} /> {copiedId ? 'COPIED!' : 'COPY ID'}
                    </button>
                  </div>
                  <code style={{ display: 'block', fontSize: '12px', color: '#38bdf8', wordBreak: 'break-all', fontFamily: 'monospace', fontWeight: 600 }}>
                    {selectedPass.id}
                  </code>
                </div>

                {/* Ticket Details Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '16px', background: 'var(--panel-subtle)', borderRadius: '12px', border: '1px solid var(--line)', marginBottom: '20px', fontSize: '12px' }}>
                  <div>
                    <span style={{ color: 'var(--text-dim)', fontSize: '11px', display: 'block' }}>Attendee Name</span>
                    <b style={{ color: 'var(--text-main)' }}>{user.profile?.name || user.name || user.memberId}</b>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-dim)', fontSize: '11px', display: 'block' }}>Member ID / Roll No</span>
                    <b style={{ color: 'var(--brand-primary)', fontFamily: 'monospace' }}>{user.profile?.rollNumber || user.memberId}</b>
                  </div>
                  {selectedPass.teamName && (
                    <div>
                      <span style={{ color: 'var(--text-dim)', fontSize: '11px', display: 'block' }}>Team Participation</span>
                      <b style={{ color: 'var(--brand-primary)' }}>{selectedPass.teamName} {selectedPass.isTeamLeader ? '(Leader)' : '(Member)'}</b>
                    </div>
                  )}
                  <div>
                    <span style={{ color: 'var(--text-dim)', fontSize: '11px', display: 'block' }}>Event Date & Time</span>
                    <span style={{ color: 'var(--text-main)' }}>{selectedPass.event?.dateTime ? new Date(selectedPass.event.dateTime).toLocaleString() : 'TBA'}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-dim)', fontSize: '11px', display: 'block' }}>Venue / Location</span>
                    <span style={{ color: 'var(--text-main)' }}>{selectedPass.event?.venue || selectedPass.event?.location || 'Campus Auditorium'}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-dim)', fontSize: '11px', display: 'block' }}>Payment Status</span>
                    <b style={{ color: '#70ddb4' }}>{selectedPass.paymentStatus} {selectedPass.totalAmount > 0 ? `(₹${selectedPass.totalAmount})` : '(Free)'}</b>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-dim)', fontSize: '11px', display: 'block' }}>Gate Attendance Status</span>
                    {selectedPass.attendanceMarked ? (
                      <b style={{ color: '#10b981' }}>CHECKED IN ({selectedPass.attendedAt ? new Date(selectedPass.attendedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Gate'})</b>
                    ) : (
                      <b style={{ color: '#f59e0b' }}>READY FOR ENTRANCE</b>
                    )}
                  </div>
                </div>

                {/* Modal Action Buttons */}
                <div style={{ display: 'flex', gap: '10px' }}>
                  {selectedPass.qrCodeData && (
                    <a
                      href={selectedPass.qrCodeData}
                      download={`event-pass-${selectedPass.event?.title || 'ticket'}.png`}
                      className="primary"
                      style={{
                        flex: 1,
                        height: '42px',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        textDecoration: 'none',
                      }}
                    >
                      <IconDownload size={14} /> DOWNLOAD PASS
                    </a>
                  )}
                  <button
                    type="button"
                    className="outline"
                    onClick={() => window.print()}
                    style={{ flex: 1, height: '42px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    PRINT PASS
                  </button>
                  <button
                    type="button"
                    className="outline"
                    onClick={() => setSelectedPass(null)}
                    style={{ height: '42px', padding: '0 16px', fontSize: '12px' }}
                  >
                    CLOSE
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </LivePortal>
  )
}

// ----------------------------------------------------
// Public Gallery (Student)
// ----------------------------------------------------
// ----------------------------------------------------
// Public Gallery (Student)
// ----------------------------------------------------
function StudentGallery({ user, logout, onNavigate }) {
  const { platformMode } = usePlatformTheme()
  const isMrdu = platformMode === 'MRDU_EVENTS'
  const [albums, setAlbums] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedAlbum, setSelectedAlbum] = useState(null)
  const [loadingAlbum, setLoadingAlbum] = useState(false)
  const [activeLightbox, setActiveLightbox] = useState(null)

  useEffect(() => {
    let mounted = true
    memberApi.listGallery()
      .then(({ albums: list }) => { if (mounted) setAlbums(list || []) })
      .catch(() => {})
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  async function handleOpenAlbum(album) {
    setSelectedAlbum(album)
    setLoadingAlbum(true)
    try {
      const res = await memberApi.getGalleryAlbum(album.id)
      if (res?.album) {
        setSelectedAlbum(res.album)
        setAlbums(curr => curr.map(a => (a.id === res.album.id ? res.album : a)))
      }
    } catch {
      // Fallback: keep local album photos if any
    } finally {
      setLoadingAlbum(false)
    }
  }

  return (
    <LivePortal user={user} logout={logout} activeTab="student-gallery" onNavigate={onNavigate} title={isMrdu ? 'MRDU EVENT GALLERY' : 'CLUB GALLERY'}>
      <section className="gallery-section">
        {selectedAlbum ? (
          // Opened Album View with all photos
          <div>
            <div className="event-heading" style={{ marginBottom: '20px' }}>
              <div>
                <button className="back-button" type="button" onClick={() => setSelectedAlbum(null)}>
                  ← BACK TO ALL ALBUMS
                </button>
                <p className="eyebrow">{isMrdu ? 'MRDU ALBUM SHOWCASE' : 'ALBUM SHOWCASE'}</p>
                <h1>{selectedAlbum.name}</h1>
                <p>{selectedAlbum.description || (isMrdu ? 'University event photo collection & highlights' : 'Club photo collection & highlights')}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="badge" style={{ background: '#0e2439', color: '#85d7ff', border: '1px solid #52bbf544', padding: '6px 12px', fontSize: '11px' }}>
                  {selectedAlbum.photos?.length || 0} Photos
                </span>
              </div>
            </div>

            {loadingAlbum ? (
              <p className="directory-state">Loading album photos...</p>
            ) : (!selectedAlbum.photos || selectedAlbum.photos.length === 0) ? (
              <article className="account-form-card" style={{ textAlign: 'center', padding: '40px 20px', color: '#8aa2b4' }}>
                <p style={{ margin: 0, fontSize: '13px' }}>No photos have been added to this album yet.</p>
              </article>
            ) : (
              <div className="gallery-grid">
                {selectedAlbum.photos.map(p => (
                  <div
                    key={p.id}
                    className="album-card-box"
                    onClick={() => setActiveLightbox(p)}
                    style={{ position: 'relative' }}
                    title="Click to view full-size photo"
                  >
                    <div className="album-cover">
                      <img src={p.imageUrl} alt={p.caption || selectedAlbum.name} />
                    </div>
                    {p.caption && (
                      <div className="album-details">
                        <p style={{ color: 'var(--text-main)', fontWeight: 500 }}>{p.caption}</p>
                      </div>
                    )}
                    <div style={{ padding: '6px 12px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <small style={{ color: 'var(--text-dim)', fontSize: '10px' }}>{new Date(p.createdAt).toLocaleDateString()}</small>
                      <small style={{ color: 'var(--brand-primary)', fontSize: '10px' }}>Expand</small>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          // Albums Directory List
          <div>
            <div className="event-heading">
              <div>
                <button className="back-button" type="button" onClick={() => onNavigate('student-dashboard')}>
                  ← BACK TO DASHBOARD
                </button>
                <p className="eyebrow">{isMrdu ? 'EVENT PHOTO ARCHIVES' : 'PHOTO MEMORIES'}</p>
                <h1>{isMrdu ? 'MRDU Events & Fests Gallery' : 'Cyber Security Club Gallery'}</h1>
                <p>{isMrdu ? 'Highlights, ceremonies, and celebrations across MRDU university events. Click any album to view photos.' : 'Highlights, award ceremonies, and lab workshops. Click any album to view its photos.'}</p>
              </div>
            </div>

            {loading ? (
              <p className="directory-state">Loading gallery albums...</p>
            ) : albums.length === 0 ? (
              <p className="directory-state">No albums published yet.</p>
            ) : (
              <div className="gallery-grid">
                {albums.map(a => (
                  <div
                    key={a.id}
                    className="album-card-box"
                    onClick={() => handleOpenAlbum(a)}
                    title={`Open "${a.name}" album`}
                  >
                    <div className="album-cover">
                      {a.coverImage || a.photos?.[0]?.imageUrl ? (
                        <img src={a.coverImage || a.photos[0].imageUrl} alt={a.name} />
                      ) : (
                        <div className="album-cover-placeholder">{a.name.slice(0, 2).toUpperCase()}</div>
                      )}
                      <span className="album-photo-count">{a.photos?.length || 0} photos</span>
                    </div>
                    <div className="album-details">
                      <h3>{a.name}</h3>
                      <p>{a.description || (isMrdu ? 'MRDU event photo highlights' : 'Club photo highlights')}</p>
                    </div>
                    <div style={{ padding: '8px 14px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <small style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>Open Album →</small>
                      <small style={{ color: 'var(--text-dim)' }}>{a.photos?.length || 0} photos</small>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Read-Only Photo Lightbox Modal with Full Navigation */}
        {activeLightbox && (
          <GalleryLightbox
            photos={selectedAlbum?.photos || []}
            activePhoto={activeLightbox}
            albumName={selectedAlbum?.name}
            onClose={() => setActiveLightbox(null)}
            onSelectPhoto={p => setActiveLightbox(p)}
          />
        )}
      </section>
    </LivePortal>
  )
}

// ----------------------------------------------------
// ----------------------------------------------------
// Campus & Event Reels Feed (Instagram-Style Vertical Player)
// ----------------------------------------------------
function StudentReels({ user, logout, onNavigate }) {
  const { platformMode } = usePlatformTheme()
  const isMrdu = platformMode === 'MRDU_EVENTS'
  const [reels, setReels] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('PLAYER') // 'PLAYER' | 'GRID'
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedCategory, setSelectedCategory] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [likedReels, setLikedReels] = useState(new Set())
  const [copiedLink, setCopiedLink] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [expandedCaption, setExpandedCaption] = useState(false)
  const [heartAnim, setHeartAnim] = useState(false)
  const lastScrollTime = useRef(0)
  const touchStartY = useRef(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    memberApi.listReels({ platformMode: isMrdu ? 'MRDU_EVENTS' : 'ALL' })
      .then(res => {
        if (mounted) {
          const list = res.reels || []
          setReels(list)
          const initialLiked = new Set(list.filter(r => r.isLiked).map(r => r.id))
          setLikedReels(initialLiked)
          setCurrentIndex(0)
        }
      })
      .catch(() => {})
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [isMrdu])

  const filteredReels = useMemo(() => {
    return reels.filter(r => {
      if (selectedCategory !== 'ALL' && r.category !== selectedCategory) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const t = (r.title || '').toLowerCase()
        const d = (r.description || '').toLowerCase()
        const h = (r.authorHandle || '').toLowerCase()
        const c = (r.category || '').toLowerCase()
        if (!t.includes(q) && !d.includes(q) && !h.includes(q) && !c.includes(q)) return false
      }
      return true
    })
  }, [reels, selectedCategory, searchQuery])

  const activeReel = (viewMode === 'PLAYER' ? filteredReels[currentIndex] : null) || filteredReels[0] || reels[0] || null

  // Record view on reel display
  useEffect(() => {
    if (activeReel?.id && viewMode === 'PLAYER') {
      setExpandedCaption(false)
      const timer = setTimeout(() => {
        memberApi.recordReelView(activeReel.id).catch(() => {})
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [activeReel?.id, viewMode])

  // Keyboard navigation for player mode
  useEffect(() => {
    if (viewMode !== 'PLAYER') return
    function handleKeyDown(e) {
      if (filteredReels.length === 0) return
      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault()
        handleNextReel()
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault()
        handlePrevReel()
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault()
        if (activeReel) handleToggleLike(activeReel)
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault()
        setIsMuted(m => !m)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentIndex, filteredReels, activeReel, viewMode])

  function handleNextReel() {
    if (currentIndex < filteredReels.length - 1) {
      setCurrentIndex(curr => curr + 1)
    }
  }

  function handlePrevReel() {
    if (currentIndex > 0) {
      setCurrentIndex(curr => curr - 1)
    }
  }

  function handleWheel(e) {
    if (viewMode !== 'PLAYER') return
    const now = Date.now()
    if (now - lastScrollTime.current < 450) return
    if (Math.abs(e.deltaY) > 30) {
      lastScrollTime.current = now
      if (e.deltaY > 0) handleNextReel()
      else handlePrevReel()
    }
  }

  function handleTouchStart(e) {
    touchStartY.current = e.touches[0]?.clientY
  }

  function handleTouchEnd(e) {
    if (touchStartY.current === null || viewMode !== 'PLAYER') return
    const touchEndY = e.changedTouches[0]?.clientY
    const diff = touchStartY.current - touchEndY
    if (Math.abs(diff) > 40) {
      if (diff > 0) handleNextReel()
      else handlePrevReel()
    }
    touchStartY.current = null
  }

  function handleToggleLike(reel) {
    const isCurrentlyLiked = likedReels.has(reel.id)
    setLikedReels(prev => {
      const next = new Set(prev)
      if (isCurrentlyLiked) next.delete(reel.id)
      else next.add(reel.id)
      return next
    })
    setReels(curr => curr.map(r => {
      if (r.id === reel.id) {
        return {
          ...r,
          likesCount: isCurrentlyLiked ? Math.max(0, r.likesCount - 1) : r.likesCount + 1,
          isLiked: !isCurrentlyLiked,
        }
      }
      return r
    }))
    memberApi.likeReel(reel.id).catch(() => {})
  }

  function handleDoubleTap(reel) {
    if (!likedReels.has(reel.id)) {
      handleToggleLike(reel)
    }
    setHeartAnim(true)
    setTimeout(() => setHeartAnim(false), 850)
  }

  function handleCopyShare(reel) {
    const shareUrl = reel.externalPostUrl || (reel.url.includes('embed') ? reel.url.replace('/embed/', '').replace('/embed', '') : reel.url)
    navigator.clipboard?.writeText(shareUrl).then(() => {
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2200)
    }).catch(() => {})
  }

  function jumpToReelInPlayer(index) {
    setCurrentIndex(index)
    setViewMode('PLAYER')
  }

  const authorHandle = activeReel?.authorHandle || (activeReel?.postedBy ? activeReel.postedBy.toLowerCase().replace(/\s+/g, '_') : 'cybersecurityclub_mrdu')
  const authorAvatar = activeReel?.authorAvatar || 'https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=150&auto=format&fit=crop&q=80'
  const audioTitle = activeReel?.audioTitle || `${authorHandle} • Original audio`
  const externalLink = activeReel?.externalPostUrl || (activeReel?.url.includes('instagram.com') ? activeReel.url.replace('/embed/', '/').replace('/embed', '') : `https://www.instagram.com/${authorHandle}`)
  const isUnwatchedAdminPush = activeReel?.isAdminUpload && !activeReel?.isWatched

  const categories = [
    { id: 'ALL', label: 'All Highlights' },
    { id: 'CAMPUS_LIFE', label: 'Campus Life' },
    { id: 'HACKATHONS', label: 'Hackathons & CTF' },
    { id: 'WORKSHOPS', label: 'Workshops' },
    { id: 'CULTURAL', label: 'Cultural & Fests' },
    { id: 'TECH_NEWS', label: 'Tech Updates' },
  ]

  return (
    <LivePortal user={user} logout={logout} activeTab="student-reels" onNavigate={onNavigate} title={isMrdu ? 'MRDU REELS & POSTS' : 'CAMPUS REELS & SOCIAL FEED'}>
      <section style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 8px 30px' }}>
        {/* Navigation Toolbar & View Switcher */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button className="back-button" type="button" onClick={() => onNavigate('student-dashboard')} style={{ margin: 0 }}>
              ← DASHBOARD
            </button>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
              Official Social Media & Reels
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className={viewMode === 'PLAYER' ? 'primary' : 'outline'}
              onClick={() => setViewMode('PLAYER')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '6px 14px', fontWeight: 700 }}
            >
              <IconVideo size={14} /> REEL PLAYER
            </button>
            <button
              type="button"
              className={viewMode === 'GRID' ? 'primary' : 'outline'}
              onClick={() => setViewMode('GRID')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '6px 14px', fontWeight: 700 }}
            >
              <Icon8 name="irisScan" size={14} /> EXPLORE GRID ({reels.length})
            </button>
          </div>
        </div>

        {/* Category Filters and Search Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', background: 'var(--bg-card)', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--brand-border-subtle)' }}>
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', maxWidth: '100%' }}>
            {categories.map(cat => (
              <button
                key={cat.id}
                type="button"
                className={`tab-btn ${selectedCategory === cat.id ? 'active' : ''}`}
                onClick={() => { setSelectedCategory(cat.id); setCurrentIndex(0) }}
                style={{
                  fontSize: '11px',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  whiteSpace: 'nowrap',
                  background: selectedCategory === cat.id ? 'var(--brand-primary)' : 'var(--panel-subtle)',
                  color: selectedCategory === cat.id ? '#ffffff' : 'var(--text-muted)',
                  border: '1px solid var(--line)',
                  cursor: 'pointer',
                  fontWeight: selectedCategory === cat.id ? 700 : 500,
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div style={{ position: 'relative', width: '220px', minWidth: '160px' }}>
            <input
              type="text"
              placeholder="Search reels or handles…"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentIndex(0) }}
              style={{ width: '100%', height: '32px', padding: '0 10px', fontSize: '11px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--bg-input)', color: 'var(--text-main)' }}
            />
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'grid', placeItems: 'center', height: '60vh', color: 'var(--text-muted)' }}>
            <div style={{ textAlign: 'center' }}>
              <div className="spinner" style={{ width: '32px', height: '32px', margin: '0 auto 12px' }} />
              <p style={{ fontSize: '12px', letterSpacing: '0.04em' }}>Loading Reels Feed…</p>
            </div>
          </div>
        ) : filteredReels.length === 0 ? (
          <article className="account-form-card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <span style={{ display: 'inline-flex', padding: '16px', borderRadius: '50%', background: 'var(--brand-badge-bg)', color: 'var(--brand-primary)', marginBottom: '14px' }}>
              <IconVideo size={36} />
            </span>
            <h3 style={{ margin: '0 0 8px', color: 'var(--text-main)' }}>No reels found in this category</h3>
            <p style={{ margin: '0 0 16px', fontSize: '13px' }}>Try selecting "All Highlights" or searching for a different keyword.</p>
            <button type="button" className="outline" onClick={() => { setSelectedCategory('ALL'); setSearchQuery('') }}>
              Reset Filters
            </button>
          </article>
        ) : viewMode === 'GRID' ? (
          /* ==================================================== */
          /* EXPLORE ALL REELS & POSTS (GRID DISCOVERY MODE)     */
          /* ==================================================== */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: '18px' }}>
            {filteredReels.map((r, idx) => (
              <article
                key={r.id}
                className="account-form-card"
                onClick={() => jumpToReelInPlayer(idx)}
                style={{
                  padding: '14px',
                  cursor: 'pointer',
                  borderRadius: '14px',
                  border: r.isFeatured ? '1px solid #f59e0b' : '1px solid var(--brand-border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Header author badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'linear-gradient(45deg, #f09433, #dc2743)', display: 'grid', placeItems: 'center' }}>
                      <span style={{ fontSize: '10px', color: '#fff', fontWeight: 800 }}>IG</span>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-main)' }}>
                      @{r.authorHandle || 'cybersecurityclub_mrdu'}
                    </span>
                  </div>
                  <span className="badge" style={{ fontSize: '9px', fontWeight: 600, background: 'var(--brand-badge-bg)', color: 'var(--brand-badge-color)' }}>
                    {r.category.replace('_', ' ')}
                  </span>
                </div>

                {/* Preview Box */}
                <div style={{ width: '100%', height: '200px', background: '#000000', borderRadius: '10px', overflow: 'hidden', position: 'relative', marginBottom: '10px', display: 'grid', placeItems: 'center' }}>
                  {r.embedType === 'DIRECT_VIDEO' ? (
                    <video src={r.url} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <iframe src={r.url} title={r.title} scrolling="no" style={{ width: '100%', height: '100%', border: 0, pointerEvents: 'none' }} />
                  )}
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.2)', display: 'grid', placeItems: 'center', transition: 'background 0.2s' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', color: '#ffffff', border: '1px solid rgba(255,255,255,0.3)' }}>
                      <IconVideo size={20} />
                    </div>
                  </div>
                </div>

                {/* Title & Description */}
                <h4 style={{ margin: '0 0 6px', fontSize: '13px', color: 'var(--text-main)', lineHeight: 1.3, fontWeight: 700 }}>
                  {r.title}
                </h4>
                {r.description && (
                  <p style={{ margin: '0 0 10px', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {r.description}
                  </p>
                )}

                {/* Action Footer */}
                <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <IconHeart size={12} color="#ef4444" filled={r.likesCount > 0} /> {r.likesCount} · {r.viewsCount} views
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--brand-primary)', fontWeight: 700 }}>
                    Watch Reel →
                  </span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          /* ==================================================== */
          /* PURE INSTAGRAM-STYLE VERTICAL REEL PLAYER            */
          /* ==================================================== */
          <div
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              position: 'relative',
              userSelect: 'none',
              padding: '10px 0',
            }}
          >
            {/* Phone/Reel Canvas Container */}
            <div
              onDoubleClick={() => activeReel && handleDoubleTap(activeReel)}
              style={{
                width: '100%',
                maxWidth: '410px',
                height: 'calc(86vh - 60px)',
                minHeight: '520px',
                maxHeight: '740px',
                background: '#000000',
                borderRadius: '20px',
                overflow: 'hidden',
                position: 'relative',
                boxShadow: `0 25px 60px rgba(0, 0, 0, 0.8), 0 0 30px ${isMrdu ? 'rgba(211, 47, 47, 0.18)' : 'rgba(82, 187, 245, 0.12)'}`,
                border: isUnwatchedAdminPush ? '2px solid var(--brand-primary)' : '1px solid rgba(255, 255, 255, 0.12)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Active Reel Embed */}
              <div style={{ width: '100%', height: '100%', position: 'relative', background: '#000000', overflow: 'hidden' }}>
                {activeReel.embedType === 'DIRECT_VIDEO' ? (
                  <video
                    src={activeReel.url}
                    autoPlay
                    loop
                    muted={isMuted}
                    playsInline
                    controls={false}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <iframe
                    key={activeReel.id}
                    src={activeReel.url}
                    title={activeReel.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    scrolling="no"
                    style={{ width: '100%', height: '100%', border: 0, overflow: 'hidden', background: '#000000', pointerEvents: 'auto' }}
                  />
                )}

                {/* Double-tap Floating Heart Animation */}
                {heartAnim && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'grid',
                      placeItems: 'center',
                      zIndex: 35,
                      pointerEvents: 'none',
                      animation: 'reelHeartPop 0.8s ease-out forwards',
                    }}
                  >
                    <div style={{ transform: 'scale(1.8)', filter: 'drop-shadow(0 0 20px rgba(239, 68, 68, 0.8))' }}>
                      <IconHeart size={56} filled color="#ef4444" />
                    </div>
                  </div>
                )}

                {/* Top Priority / Direct App Pill */}
                <div style={{ position: 'absolute', top: '12px', left: '12px', right: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 22, pointerEvents: 'auto' }}>
                  {isUnwatchedAdminPush ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'var(--brand-gradient)',
                        color: '#050c14',
                        padding: '4px 10px',
                        borderRadius: '16px',
                        fontWeight: 800,
                        fontSize: '10px',
                        letterSpacing: '0.04em',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
                      }}
                    >
                      <IconFlame size={12} /> NEW HIGHLIGHT
                    </div>
                  ) : (
                    <span style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', padding: '3px 8px', borderRadius: '12px', fontSize: '10px', color: '#ffffff', fontWeight: 600 }}>
                      {currentIndex + 1} of {filteredReels.length}
                    </span>
                  )}

                  {/* Direct Launch Instagram App Pill */}
                  <a
                    href={externalLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      background: 'rgba(236, 72, 153, 0.85)',
                      color: '#ffffff',
                      textDecoration: 'none',
                      padding: '4px 10px',
                      borderRadius: '16px',
                      fontSize: '10px',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                    }}
                  >
                    <IconVideo size={11} /> Open in Instagram
                  </a>
                </div>

                {/* Instagram Floating Right Action Bar */}
                <div
                  style={{
                    position: 'absolute',
                    right: '12px',
                    bottom: '95px',
                    zIndex: 25,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '16px',
                  }}
                >
                  {/* Like Button */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleToggleLike(activeReel) }}
                      style={{
                        background: 'rgba(20, 20, 20, 0.65)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255, 255, 255, 0.18)',
                        borderRadius: '50%',
                        width: '44px',
                        height: '44px',
                        display: 'grid',
                        placeItems: 'center',
                        color: likedReels.has(activeReel.id) ? '#ef4444' : '#ffffff',
                        cursor: 'pointer',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                        transition: 'transform 0.15s',
                      }}
                      title={likedReels.has(activeReel.id) ? 'Unlike' : 'Like'}
                    >
                      <IconHeart size={22} filled={likedReels.has(activeReel.id)} color={likedReels.has(activeReel.id) ? '#ef4444' : '#ffffff'} />
                    </button>
                    <span style={{ fontSize: '11px', color: '#ffffff', fontWeight: 700, textShadow: '0 2px 4px rgba(0,0,0,0.9)', fontFamily: 'DM Mono' }}>
                      {activeReel.likesCount || 0}
                    </span>
                  </div>

                  {/* Share Link Button */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleCopyShare(activeReel) }}
                      style={{
                        background: 'rgba(20, 20, 20, 0.65)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255, 255, 255, 0.18)',
                        borderRadius: '50%',
                        width: '44px',
                        height: '44px',
                        display: 'grid',
                        placeItems: 'center',
                        color: '#ffffff',
                        cursor: 'pointer',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                      }}
                      title="Copy Share Link"
                    >
                      <IconLink size={18} />
                    </button>
                    <span style={{ fontSize: '10px', color: '#ffffff', fontWeight: 600, textShadow: '0 2px 4px rgba(0,0,0,0.9)' }}>
                      {copiedLink ? 'Copied!' : 'Share'}
                    </span>
                  </div>

                  {/* External Instagram Link */}
                  <a
                    href={externalLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      background: 'rgba(20, 20, 20, 0.65)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255, 255, 255, 0.18)',
                      borderRadius: '50%',
                      width: '44px',
                      height: '44px',
                      display: 'grid',
                      placeItems: 'center',
                      color: '#ffffff',
                      textDecoration: 'none',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                    }}
                    title="Open on Instagram"
                  >
                    <IconVideo size={18} />
                  </a>

                  {/* Sound Toggle */}
                  {activeReel.embedType === 'DIRECT_VIDEO' && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setIsMuted(m => !m) }}
                      style={{
                        background: 'rgba(20, 20, 20, 0.65)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255, 255, 255, 0.18)',
                        borderRadius: '50%',
                        width: '38px',
                        height: '38px',
                        display: 'grid',
                        placeItems: 'center',
                        color: '#ffffff',
                        cursor: 'pointer',
                      }}
                      title={isMuted ? 'Unmute' : 'Mute'}
                    >
                      <span style={{ fontSize: '12px' }}>{isMuted ? 'MUTE' : 'ON'}</span>
                    </button>
                  )}
                </div>

                {/* Instagram Bottom Overlay (Profile, Caption, Audio) */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: '30px 60px 16px 14px',
                    background: 'linear-gradient(to top, rgba(0,0,0,0.94) 0%, rgba(0,0,0,0.65) 55%, transparent 100%)',
                    color: '#ffffff',
                    zIndex: 20,
                    pointerEvents: 'auto',
                  }}
                >
                  {/* Author Profile Row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <div
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '50%',
                        padding: '2px',
                        background: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)',
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <img
                        src={authorAvatar}
                        alt={authorHandle}
                        style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                      />
                    </div>

                    <a
                      href={externalLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: '13px',
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        textShadow: '0 1px 4px rgba(0,0,0,0.8)',
                      }}
                    >
                      @{authorHandle}
                      <span style={{ color: '#38bdf8', fontSize: '12px' }}>✓</span>
                    </a>

                    <a
                      href={externalLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        border: '1px solid rgba(255, 255, 255, 0.4)',
                        background: 'rgba(255, 255, 255, 0.1)',
                        color: '#ffffff',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '10px',
                        fontWeight: 700,
                        textDecoration: 'none',
                        marginLeft: '4px',
                      }}
                    >
                      Follow
                    </a>
                  </div>

                  {/* Title & Caption */}
                  <div style={{ marginBottom: '8px' }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '12px',
                        lineHeight: 1.45,
                        color: '#f1f5f9',
                        textShadow: '0 1px 3px rgba(0,0,0,0.9)',
                        maxHeight: expandedCaption ? '220px' : '38px',
                        overflow: expandedCaption ? 'y-auto' : 'hidden',
                        textOverflow: 'ellipsis',
                        transition: 'max-height 0.2s ease',
                      }}
                    >
                      <b>{activeReel.title}</b>
                      {activeReel.description && (
                        <span> — {activeReel.description}</span>
                      )}
                    </p>

                    {activeReel.description && activeReel.description.length > 60 && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setExpandedCaption(exp => !exp) }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#94a3b8',
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: 0,
                          marginTop: '2px',
                          cursor: 'pointer',
                        }}
                      >
                        {expandedCaption ? 'less' : '...more'}
                      </button>
                    )}
                  </div>

                  {/* Audio Track Ticker */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '11px',
                      color: '#cbd5e1',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span style={{ fontSize: '11px' }}>♫</span>
                    <span style={{ fontFamily: 'DM Mono', fontSize: '10px', opacity: 0.9 }}>
                      {audioTitle}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Desktop Side Navigation Arrows */}
            <div style={{ position: 'absolute', right: 'calc(50% - 275px)', display: 'flex', flexDirection: 'column', gap: '12px', zIndex: 30 }}>
              <button
                type="button"
                className="outline"
                disabled={currentIndex === 0}
                onClick={handlePrevReel}
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  background: 'var(--panel-subtle)',
                  borderColor: 'var(--line)',
                  cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
                  opacity: currentIndex === 0 ? 0.3 : 1,
                  color: 'var(--text-main)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                }}
                title="Previous Reel (Up Arrow)"
              >
                <IconChevronUp size={18} />
              </button>
              <div style={{ textAlign: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', fontFamily: 'DM Mono' }}>
                {currentIndex + 1}/{filteredReels.length}
              </div>
              <button
                type="button"
                className="outline"
                disabled={currentIndex === filteredReels.length - 1}
                onClick={handleNextReel}
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  background: 'var(--panel-subtle)',
                  borderColor: 'var(--line)',
                  cursor: currentIndex === filteredReels.length - 1 ? 'not-allowed' : 'pointer',
                  opacity: currentIndex === filteredReels.length - 1 ? 0.3 : 1,
                  color: 'var(--text-main)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                }}
                title="Next Reel (Down Arrow)"
              >
                <IconChevronDown size={18} />
              </button>
            </div>
          </div>
        )}
      </section>
    </LivePortal>
  )
}

// ----------------------------------------------------
// Public Team Showcase (Student)
// ----------------------------------------------------
function OurTeamShowcase({ user, logout, onNavigate }) {
  const { platformMode } = usePlatformTheme()
  const isMrdu = platformMode === 'MRDU_EVENTS'
  const [team, setTeam] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    memberApi.listClubTeam()
      .then(({ team: list }) => { if (mounted) setTeam(list || []) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  return (
    <LivePortal user={user} logout={logout} activeTab="student-team" onNavigate={onNavigate} title={isMrdu ? 'ORGANIZING COMMITTEE' : 'CLUB LEADERSHIP'}>
      <section className="member-management">
        <div className="member-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate('student-dashboard')}>
              ← BACK TO DASHBOARD
            </button>
            <p className="eyebrow">{isMrdu ? 'CENTRAL ORGANIZING COMMITTEE' : 'STUDENT COUNCIL'}</p>
            <h1>{isMrdu ? 'Meet Our Organizing Committee' : 'Meet Our Leadership'}</h1>
            <p>{isMrdu ? 'The faculty coordinators, event convenors, and student organizers managing MRDU Events.' : 'The student coordinators and executive leads driving Cyber Security Club MRDU.'}</p>
          </div>
        </div>

        {loading ? (
          <p className="directory-state">Loading leadership profiles...</p>
        ) : team.length === 0 ? (
          <p className="directory-state">No team members published yet.</p>
        ) : (
          <div className="team-grid">
            {team.map(l => (
              <div className="leader-card" key={l.id}>
                {l.photoUrl ? (
                  <img className="leader-photo" src={l.photoUrl} alt={l.name} />
                ) : (
                  <div className="leader-photo-placeholder">{l.name.slice(0, 2).toUpperCase()}</div>
                )}
                <b style={{ color: 'var(--text-main)', fontSize: '15px' }}>{l.name}</b>
                <small style={{ color: 'var(--brand-primary)', font: '600 10px "DM Mono", monospace', margin: '4px 0' }}>{l.roleTitle}</small>
                <p style={{ color: 'var(--text-muted)', fontSize: '11px', margin: '6px 0 12px' }}>{l.bio}</p>
                <div className="leader-socials">
                  {l.linkedinUrl && <a className="social-pill" href={l.linkedinUrl} target="_blank" rel="noreferrer">LinkedIn</a>}
                  {l.githubUrl && <a className="social-pill" href={l.githubUrl} target="_blank" rel="noreferrer">GitHub</a>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </LivePortal>
  )
}

// ----------------------------------------------------
// Admin QR Code Scanner & Event Entry Gate
// ----------------------------------------------------
function AdminQrScanner({ user, logout, onNavigate }) {
  const { platformMode } = usePlatformTheme()
  const isMrdu = platformMode === 'MRDU_EVENTS'

  const [inputCode, setInputCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [scanResult, setScanResult] = useState(null)
  const [recentScans, setRecentScans] = useState([])
  const [cameraActive, setCameraActive] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [laserActive, setLaserActive] = useState(false)
  const [cameraFacingMode, setCameraFacingMode] = useState('environment') // 'environment' (Back) or 'user' (Front)
  const [availableCameras, setAvailableCameras] = useState([])
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const [torchOn, setTorchOn] = useState(false)
  const [hasTorch, setHasTorch] = useState(false)

  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const animFrameRef = useRef(null)
  const lastScannedRef = useRef({ code: '', time: 0 })
  const fileInputRef = useRef(null)

  function playScanBeep() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(880, ctx.currentTime)
      gain.gain.setValueAtTime(0.2, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.16)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.16)
      navigator.vibrate?.([90])
    } catch {}
  }

  async function refreshCameraDevices() {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter(d => d.kind === 'videoinput')
      setAvailableCameras(videoDevices)
    } catch {}
  }

  async function handleToggleTorch() {
    if (!streamRef.current) return
    const track = streamRef.current.getVideoTracks()[0]
    if (!track) return
    try {
      const nextState = !torchOn
      await track.applyConstraints({
        advanced: [{ torch: nextState }],
      })
      setTorchOn(nextState)
    } catch (e) {
      console.warn('Torch toggle not supported:', e)
    }
  }

  function handleToggleCameraFacing() {
    setTorchOn(false)
    setSelectedDeviceId('')
    setCameraFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'))
  }

  function handleSelectCameraDevice(deviceId) {
    setTorchOn(false)
    setSelectedDeviceId(deviceId)
  }

  // Real-time Camera Stream and Hardware-Accelerated + jsQR Frame Processor
  useEffect(() => {
    if (!cameraActive) {
      setTorchOn(false)
      setHasTorch(false)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
        animFrameRef.current = null
      }
      return
    }

    let isMounted = true

    async function startCamera() {
      setError('')
      try {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop())
          streamRef.current = null
        }

        const videoConstraints = selectedDeviceId
          ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { facingMode: { ideal: cameraFacingMode }, width: { ideal: 1280 }, height: { ideal: 720 } }

        const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints })
        if (!isMounted) {
          stream.getTracks().forEach(t => t.stop())
          return
        }
        streamRef.current = stream

        // Check if torch/flashlight is supported
        const track = stream.getVideoTracks()[0]
        if (track && typeof track.getCapabilities === 'function') {
          const caps = track.getCapabilities()
          setHasTorch(Boolean(caps?.torch))
        } else {
          setHasTorch(false)
        }

        refreshCameraDevices()

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.setAttribute('playsinline', 'true')
          await videoRef.current.play().catch(() => {})
        }

        // Initialize Native Hardware-Accelerated BarcodeDetector if available
        let nativeDetector = null
        if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
          try {
            nativeDetector = new window.BarcodeDetector({ formats: ['qr_code'] })
          } catch {}
        }

        // High efficiency scanning canvas with optimal downscaling
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d', { willReadFrequently: true })

        let scanningBusy = false
        let frameCount = 0

        async function scanTick() {
          if (!isMounted) return
          frameCount++

          const video = videoRef.current
          if (video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0 && !scanningBusy) {
            // Process every frame with native detector, or throttle every 2nd frame for jsQR
            if (nativeDetector || frameCount % 2 === 0) {
              scanningBusy = true
              try {
                let detectedText = null

                // 1. Try Hardware-Accelerated Native BarcodeDetector first (<2ms detection)
                if (nativeDetector) {
                  try {
                    const barcodes = await nativeDetector.detect(video)
                    if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                      detectedText = barcodes[0].rawValue.trim()
                    }
                  } catch {}
                }

                // 2. High-Performance jsQR Fallback (optimized downscale)
                if (!detectedText) {
                  const scale = Math.min(1, 640 / video.videoWidth)
                  const targetW = Math.round(video.videoWidth * scale)
                  const targetH = Math.round(video.videoHeight * scale)

                  canvas.width = targetW
                  canvas.height = targetH

                  ctx.drawImage(video, 0, 0, targetW, targetH)
                  const imgData = ctx.getImageData(0, 0, targetW, targetH)

                  let code = jsQR(imgData.data, imgData.width, imgData.height, {
                    inversionAttempts: 'attemptBoth',
                  })

                  // If user camera is flipped, check horizontal mirror pass
                  if (!code && cameraFacingMode === 'user') {
                    ctx.save()
                    ctx.translate(targetW, 0)
                    ctx.scale(-1, 1)
                    ctx.drawImage(video, 0, 0, targetW, targetH)
                    ctx.restore()
                    const flippedData = ctx.getImageData(0, 0, targetW, targetH)
                    code = jsQR(flippedData.data, flippedData.width, flippedData.height, {
                      inversionAttempts: 'attemptBoth',
                    })
                  }

                  if (code && code.data && code.data.trim()) {
                    detectedText = code.data.trim()
                  }
                }

                if (detectedText) {
                  const now = Date.now()
                  if (detectedText !== lastScannedRef.current.code || now - lastScannedRef.current.time > 2200) {
                    lastScannedRef.current = { code: detectedText, time: now }
                    playScanBeep()
                    setLaserActive(true)
                    setTimeout(() => setLaserActive(false), 800)
                    handleProcessScan(detectedText)
                  }
                }
              } finally {
                scanningBusy = false
              }
            }
          }

          animFrameRef.current = requestAnimationFrame(scanTick)
        }

        animFrameRef.current = requestAnimationFrame(scanTick)
      } catch (err) {
        setError(`Camera access error: ${err.message || 'Please allow camera permission or use manual/file upload input.'}`)
        setCameraActive(false)
      }
    }

    startCamera()

    return () => {
      isMounted = false
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
        animFrameRef.current = null
      }
    }
  }, [cameraActive, cameraFacingMode, selectedDeviceId])

  async function handleProcessScan(codeToScan) {
    const rawCode = String(codeToScan || '').trim()
    if (!rawCode) return

    setLoading(true)
    setError('')
    setSuccessMessage('')

    try {
      const res = await adminApi.scanQrCode(rawCode)
      setScanResult(res)

      // Add to recent scans
      const attendeeName = res.scanType === 'EVENT_PASS'
        ? (res.registration?.user?.name || res.registration?.user?.memberId)
        : (res.event?.title || 'Event')
      const eventOrId = res.scanType === 'EVENT_PASS'
        ? res.registration?.event?.title
        : `Event · ${res.event?.venue || 'Campus'}`

      setRecentScans(prev => [
        {
          id: Date.now(),
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          name: attendeeName,
          type: res.scanType,
          info: eventOrId,
          alreadyCheckedIn: Boolean(res.registration?.attendanceMarked),
        },
        ...prev.slice(0, 9),
      ])
    } catch (err) {
      const msg = err.message && err.message !== 'Request failed.'
        ? err.message
        : 'Unrecognized Event Pass QR. Please ensure this pass is for a registered event attendee.'
      setError(msg)
      setScanResult(null)
    } finally {
      setLoading(false)
    }
  }

  function handleManualSubmit(e) {
    e.preventDefault()
    if (!inputCode.trim()) return
    handleProcessScan(inputCode.trim())
    setInputCode('')
  }

  // Upload and decode QR from saved photo / screenshot
  function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setSuccessMessage('')

    const reader = new FileReader()
    reader.onload = evt => {
      const img = new Image()
      img.onload = () => {
        const c = document.createElement('canvas')
        c.width = img.width
        c.height = img.height
        const cCtx = c.getContext('2d')
        cCtx.drawImage(img, 0, 0)
        const imgData = cCtx.getImageData(0, 0, c.width, c.height)
        let decoded = jsQR(imgData.data, imgData.width, imgData.height, { inversionAttempts: 'attemptBoth' })

        // If not found, try horizontal flip
        if (!decoded) {
          cCtx.save()
          cCtx.translate(c.width, 0)
          cCtx.scale(-1, 1)
          cCtx.drawImage(img, 0, 0)
          cCtx.restore()
          const flippedData = cCtx.getImageData(0, 0, c.width, c.height)
          decoded = jsQR(flippedData.data, flippedData.width, flippedData.height, { inversionAttempts: 'attemptBoth' })
        }

        if (decoded && decoded.data) {
          playScanBeep()
          handleProcessScan(decoded.data)
        } else {
          setError('No readable QR code detected in the uploaded image. Please ensure the QR code is clear and in focus.')
        }
      }
      img.src = evt.target.result
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  async function handleGrantEntry(regId) {
    if (!regId) return
    setActionLoading(true)
    setError('')
    setSuccessMessage('')

    try {
      const res = await adminApi.grantEventEntry(regId)
      setSuccessMessage(res.message || '✓ Entry granted & attendance verified successfully!')

      // Update current scanResult state
      setScanResult(curr => {
        if (!curr) return null
        if (curr.scanType === 'EVENT_PASS' && curr.registration?.id === regId) {
          return {
            ...curr,
            registration: {
              ...curr.registration,
              attendanceMarked: true,
              attendedAt: new Date().toISOString(),
              attendanceVerifiedBy: user.memberId || user.name || 'Coordinator',
            },
          }
        }
        return curr
      })
    } catch (err) {
      setError(err.message || 'Failed to grant entry.')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <LivePortal user={user} logout={logout} activeTab="admin-qr-scanner" onNavigate={onNavigate} title="EVENT PASS GATE SCANNER">
      <section className="member-management">
        <div className="member-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate('admin-events')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              ← BACK TO EVENT MANAGEMENT
            </button>
            <p className="eyebrow">EVENT TICKET VERIFICATION & GATE ENTRY</p>
            <h1>Event Pass QR Scanner</h1>
            <p>Scan attendee Event QR passes to verify registration credentials, confirm payment, and record entrance attendance.</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
            <button
              type="button"
              className="outline"
              onClick={() => fileInputRef.current?.click()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '8px 14px' }}
              title="Upload an image or screenshot of a QR pass"
            >
              <Icon8 name="document" size={16} /> UPLOAD PASS IMAGE
            </button>
            <button
              type="button"
              className={cameraActive ? 'primary' : 'outline'}
              onClick={() => setCameraActive(a => !a)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '8px 14px' }}
            >
              <Icon8 name="irisScan" size={16} /> {cameraActive ? 'STOP CAMERA SCANNER' : 'START CAMERA SCANNER'}
            </button>
            <button
              type="button"
              className="outline"
              onClick={() => onNavigate('admin-events')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '8px 14px' }}
            >
              <IconCalendar size={14} /> EVENTS CATALOG
            </button>
          </div>
        </div>

        {error && (
          <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef444466', color: '#fca5a5', fontSize: '13px', margin: '0 0 16px' }}>
            {error}
          </div>
        )}

        {successMessage && (
          <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b98166', color: '#6ee7b7', fontSize: '13px', margin: '0 0 16px', fontWeight: 600 }}>
            {successMessage}
          </div>
        )}

        <div className="member-management-grid">
          {/* Left Column: Scanner View & Manual Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Camera Viewport */}
            {cameraActive ? (
              <article className="account-form-card" style={{ padding: '16px', textAlign: 'center', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 8px #10b981' }} />
                    {cameraFacingMode === 'environment' ? '📷 BACK CAMERA (ENVIRONMENT)' : '🤳 FRONT CAMERA (USER)'}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {hasTorch && (
                      <button
                        type="button"
                        onClick={handleToggleTorch}
                        style={{
                          background: torchOn ? '#f59e0b' : 'var(--panel-subtle)',
                          color: torchOn ? '#000' : 'var(--text-main)',
                          border: '1px solid var(--line)',
                          borderRadius: '6px',
                          padding: '4px 10px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                        title="Toggle Flashlight / Torch"
                      >
                        ⚡ {torchOn ? 'TORCH ON' : 'TORCH OFF'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleToggleCameraFacing}
                      style={{
                        background: 'var(--brand-badge-bg)',
                        color: 'var(--brand-primary)',
                        border: '1px solid var(--brand-border-subtle)',
                        borderRadius: '6px',
                        padding: '4px 10px',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                      title="Switch between front and back camera"
                    >
                      🔄 FLIP CAMERA
                    </button>
                  </div>
                </div>

                {availableCameras.length > 1 && (
                  <div style={{ marginBottom: '10px', textAlign: 'left' }}>
                    <select
                      value={selectedDeviceId}
                      onChange={e => handleSelectCameraDevice(e.target.value)}
                      style={{
                        width: '100%',
                        height: '32px',
                        background: 'var(--bg-input)',
                        color: 'var(--text-main)',
                        border: '1px solid var(--line)',
                        borderRadius: '6px',
                        fontSize: '11px',
                        padding: '0 8px',
                      }}
                    >
                      <option value="">Default ({cameraFacingMode === 'environment' ? 'Back' : 'Front'} Camera)</option>
                      {availableCameras.map((cam, idx) => (
                        <option key={cam.deviceId || idx} value={cam.deviceId}>
                          {cam.label || `Camera ${idx + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={{ position: 'relative', width: '100%', height: '280px', background: '#000', borderRadius: '12px', overflow: 'hidden', border: laserActive ? '2px solid #10b981' : '2px solid var(--brand-primary)', boxShadow: laserActive ? '0 0 24px rgba(16, 185, 129, 0.5)' : 'none', transition: 'all 0.2s' }}>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transform: cameraFacingMode === 'user' ? 'scaleX(-1)' : 'none',
                      transition: 'transform 0.2s ease',
                    }}
                  />
                  {/* Cyber Target Overlay */}
                  <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
                    <div style={{ width: '190px', height: '190px', border: laserActive ? '2px solid #10b981' : `2px dashed ${isMrdu ? '#d32f2f' : '#52bbf5'}`, borderRadius: '12px', boxShadow: laserActive ? '0 0 25px #10b981' : `0 0 20px ${isMrdu ? 'rgba(211,47,47,0.4)' : 'rgba(82,187,245,0.3)'}` }} />
                  </div>
                  {/* Laser Scan line */}
                  <div
                    style={{
                      position: 'absolute',
                      left: '10%',
                      right: '10%',
                      height: '2px',
                      background: laserActive ? '#10b981' : `linear-gradient(90deg, transparent, ${isMrdu ? '#ef5350' : '#38bdf8'}, transparent)`,
                      boxShadow: laserActive ? '0 0 14px #10b981' : `0 0 12px ${isMrdu ? '#d32f2f' : '#38bdf8'}`,
                      top: '50%',
                      animation: 'scanline 2s ease-in-out infinite alternate',
                    }}
                  />
                </div>
                <small style={{ display: 'block', marginTop: '8px', color: 'var(--text-muted)', fontSize: '11px' }}>
                  Point camera steadily at the Event Pass QR code · Hardware accelerated scanning active
                </small>
              </article>
            ) : null}

            {/* Manual / USB Barcode Scanner Input */}
            <article className="account-form-card">
              <p className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Icon8 name="captcha" size={14} /> DIRECT PASS LOOKUP
              </p>
              <h3 style={{ margin: '4px 0 12px', color: 'var(--text-main)' }}>USB Barcode Scanner or Pass ID</h3>
              <form onSubmit={handleManualSubmit}>
                <div className="login-field-group">
                  <label style={{ color: 'var(--text-dim)', fontSize: '11px' }}>
                    Scan Event QR Code or Enter Pass ID / Member ID
                  </label>
                  <div className="login-input-wrapper">
                    <span className="login-input-icon"><Icon8 name="irisScan" size={16} /></span>
                    <input
                      type="text"
                      placeholder="e.g. EVENT_PASS:... or registration ID"
                      value={inputCode}
                      onChange={e => setInputCode(e.target.value)}
                      autoFocus
                      style={{ background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: '13px' }}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                  <button
                    type="button"
                    className="outline"
                    onClick={() => fileInputRef.current?.click()}
                    style={{ flex: 1, height: '40px', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <Icon8 name="document" size={14} /> UPLOAD FILE
                  </button>
                  <button
                    type="submit"
                    className="primary"
                    disabled={loading || !inputCode.trim()}
                    style={{ flex: 2, height: '40px', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    <Icon8 name="authentication" size={16} />
                    {loading ? 'VERIFYING PASS…' : 'VERIFY EVENT PASS ➔'}
                  </button>
                </div>
              </form>
            </article>

            {/* Recent Scans Session Feed */}
            {recentScans.length > 0 && (
              <article className="account-form-card" style={{ padding: '16px' }}>
                <p className="eyebrow" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Icon8 name="realtime" size={14} /> LIVE GATE LOG
                </p>
                <h4 style={{ margin: '4px 0 12px', fontSize: '13px', color: 'var(--text-main)' }}>Recent Pass Scans in This Session</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
                  {recentScans.map(s => (
                    <div
                      key={s.id}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        background: 'var(--panel-subtle)',
                        border: '1px solid var(--line)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '11px',
                      }}
                    >
                      <div>
                        <b style={{ color: 'var(--text-main)' }}>{s.name}</b>
                        <small style={{ display: 'block', color: 'var(--text-muted)' }}>{s.info}</small>
                      </div>
                      <span className="badge" style={{ background: s.alreadyCheckedIn ? '#78350f' : '#064e3b', color: s.alreadyCheckedIn ? '#fde68a' : '#6ee7b7', fontSize: '9px' }}>
                        {s.time}
                      </span>
                    </div>
                  ))}
                </div>
              </article>
            )}
          </div>

          {/* Right Column: Event Pass Scan Result & Entry Action */}
          <div>
            {scanResult ? (
              <article
                className="account-form-card"
                style={{
                  padding: '24px',
                  border: scanResult.scanType === 'EVENT_PASS' && scanResult.registration?.attendanceMarked ? '2px solid #ef4444' : '2px solid var(--brand-primary)',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                }}
              >
                {/* EVENT PASS SCAN RESULT */}
                {scanResult.scanType === 'EVENT_PASS' && (
                  <div>
                    {/* Header Alert Banner */}
                    {scanResult.registration.attendanceMarked ? (
                      <div
                        style={{
                          padding: '14px',
                          borderRadius: '10px',
                          background: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid #ef4444',
                          color: '#fca5a5',
                          marginBottom: '20px',
                        }}
                      >
                        <b style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Icon8 name="protect" size={18} /> DUPLICATE ENTRY PROHIBITED
                        </b>
                        <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#fecaca' }}>
                          Attendance was <b>already granted</b> for this pass on{' '}
                          {scanResult.registration.attendedAt ? new Date(scanResult.registration.attendedAt).toLocaleString() : 'earlier'}{' '}
                          by <b>{scanResult.registration.attendanceVerifiedBy || 'Coordinator'}</b>.
                        </p>
                      </div>
                    ) : (
                      <div
                        style={{
                          padding: '14px',
                          borderRadius: '10px',
                          background: 'rgba(16, 185, 129, 0.15)',
                          border: '1px solid #10b981',
                          color: '#6ee7b7',
                          marginBottom: '20px',
                        }}
                      >
                        <b style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Icon8 name="authentication" size={18} /> VALID EVENT PASS — READY FOR ENTRY
                        </b>
                        <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#a7f3d0' }}>
                          Registration verified in system records. Click below to admit attendee and record gate attendance.
                        </p>
                      </div>
                    )}

                    {/* Event Details Card */}
                    <div style={{ padding: '16px', borderRadius: '12px', background: 'var(--panel-subtle)', border: '1px solid var(--line)', marginBottom: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span className="badge" style={{ background: 'var(--brand-badge-bg)', color: 'var(--brand-badge-color)', fontSize: '10px' }}>
                          {scanResult.registration.event.eventType}
                        </span>
                        <small style={{ color: 'var(--brand-primary)', font: '600 10px monospace' }}>
                          EVENT ID: {scanResult.registration.event.id.slice(0, 8)}...
                        </small>
                      </div>

                      <h2 style={{ margin: '4px 0 8px', font: '700 22px Syne', color: 'var(--text-main)' }}>
                        {scanResult.registration.event.title}
                      </h2>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px', marginTop: '12px', color: 'var(--text-muted)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <IconCalendar size={14} /> {scanResult.registration.event.dateTime ? new Date(scanResult.registration.event.dateTime).toLocaleString() : 'TBA'}
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <IconLocationPin size={14} /> {scanResult.registration.event.venue || 'Campus Auditorium'}
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <IconCreditCard size={14} /> Payment: <b style={{ color: '#70ddb4', marginLeft: 4 }}>{scanResult.registration.paymentStatus}</b>
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <Icon8 name="access" size={14} /> Pass ID: {scanResult.registration.id.slice(0, 12)}...
                        </span>
                      </div>
                    </div>

                    {/* Attendee Ticket Details */}
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center', padding: '14px', borderRadius: '10px', background: 'var(--bg-input)', border: '1px solid var(--line)', marginBottom: '20px' }}>
                      {scanResult.registration.user.profileImage ? (
                        <img
                          src={scanResult.registration.user.profileImage}
                          alt="Attendee Avatar"
                          style={{ width: '56px', height: '56px', borderRadius: '10px', objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{ width: '56px', height: '56px', borderRadius: '10px', background: 'var(--brand-gradient)', display: 'grid', placeItems: 'center' }}>
                          <Icon8 name="user" size={26} />
                        </div>
                      )}
                      <div>
                        <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '16px' }}>{scanResult.registration.user.name}</h3>
                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--brand-primary)', fontFamily: 'monospace' }}>
                          Roll No / ID: {scanResult.registration.user.rollNumber || scanResult.registration.user.memberId}
                        </p>
                        <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                          {scanResult.registration.user.department || 'Engineering'} {scanResult.registration.user.year ? `· Year ${scanResult.registration.user.year}` : ''}
                        </small>
                      </div>
                    </div>

                    {/* Entry Action Button */}
                    <button
                      type="button"
                      className="primary"
                      disabled={actionLoading || scanResult.registration.attendanceMarked}
                      onClick={() => handleGrantEntry(scanResult.registration.id)}
                      style={{
                        width: '100%',
                        minHeight: '48px',
                        fontSize: '13px',
                        fontWeight: 700,
                        background: scanResult.registration.attendanceMarked ? '#374151' : 'linear-gradient(135deg, #10b981, #059669)',
                        borderColor: scanResult.registration.attendanceMarked ? '#4b5563' : '#10b981',
                        cursor: scanResult.registration.attendanceMarked ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        marginBottom: '12px',
                      }}
                    >
                      <Icon8 name={scanResult.registration.attendanceMarked ? 'protect' : 'faceId'} size={18} />
                      {actionLoading ? 'RECORDING CHECK-IN…' : scanResult.registration.attendanceMarked ? 'ENTRY ALREADY GRANTED' : 'GRANT EVENT ENTRY & MARK ATTENDANCE'}
                    </button>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        type="button"
                        className="outline"
                        onClick={() => {
                          setScanResult(null)
                          setInputCode('')
                        }}
                        style={{ flex: 1, fontSize: '11px', height: '38px' }}
                      >
                        SCAN NEXT PASS
                      </button>
                      <button
                        type="button"
                        className="outline"
                        onClick={() => onNavigate('admin-events')}
                        style={{ flex: 1, fontSize: '11px', height: '38px' }}
                      >
                        VIEW IN EVENT STUDIO →
                      </button>
                    </div>
                  </div>
                )}

                {/* DIRECT EVENT OVERVIEW */}
                {scanResult.scanType === 'EVENT_DIRECT' && (
                  <div style={{ textAlign: 'center', padding: '20px 10px' }}>
                    <span className="badge" style={{ background: 'var(--brand-badge-bg)', color: 'var(--brand-badge-color)', fontSize: '10px' }}>
                      {scanResult.event.eventType}
                    </span>
                    <h2 style={{ margin: '8px 0', font: '700 22px Syne', color: 'var(--text-main)' }}>
                      {scanResult.event.title}
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                      {scanResult.event.venue} · {scanResult.event.dateTime ? new Date(scanResult.event.dateTime).toLocaleString() : 'TBA'}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', margin: '20px 0' }}>
                      <div className="stat" style={{ padding: '12px 20px', minWidth: '120px' }}>
                        <p>REGISTERED</p>
                        <h2>{scanResult.event.totalRegistrations}</h2>
                      </div>
                      <div className="stat green" style={{ padding: '12px 20px', minWidth: '120px' }}>
                        <p>ATTENDED</p>
                        <h2>{scanResult.event.attendedCount}</h2>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="primary"
                      onClick={() => onNavigate('admin-events')}
                      style={{ width: '100%', height: '42px', fontSize: '12px' }}
                    >
                      OPEN EVENT IN STUDIO →
                    </button>
                  </div>
                )}
              </article>
            ) : (
              <article className="account-form-card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                <span style={{ display: 'block', marginBottom: '14px' }}>
                  <Icon8 name="irisScan" size={48} />
                </span>
                <h3 style={{ color: 'var(--text-main)', margin: '0 0 6px' }}>Ready to Scan Event Pass</h3>
                <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.6 }}>
                  Point the camera at an attendee's Event QR pass, or upload a pass image to verify registration and record gate attendance.
                </p>
              </article>
            )}
          </div>
        </div>
      </section>
    </LivePortal>
  )
}

// ----------------------------------------------------
// Admin Command Center Dashboard (Clean & Structured)
// ----------------------------------------------------
function LivePresidentDashboard({ user, logout, onNavigate }) {
  const isPresident = user.isPrimaryAdmin || user.role === 'PRESIDENT'
  const [memberCount, setMemberCount] = useState(null)
  const [eventCount, setEventCount] = useState(null)
  const [subStats, setSubStats] = useState({ activeSubscriptions: 0, pendingVerification: 0 })

  // Presidential Directives & To-Dos State
  const [directivesData, setDirectivesData] = useState({
    announcement: '',
    todos: [],
    updatedAt: null,
    updatedBy: null,
  })
  const [loadingDirectives, setLoadingDirectives] = useState(true)
  const [directivesError, setDirectivesError] = useState('')
  const [directivesMessage, setDirectivesMessage] = useState('')

  // Briefing Editor State
  const [isEditingBriefing, setIsEditingBriefing] = useState(false)
  const [briefingDraft, setBriefingDraft] = useState('')
  const [savingBriefing, setSavingBriefing] = useState(false)

  // Add To-Do Modal State
  const [showAddTodoModal, setShowAddTodoModal] = useState(false)
  const [newTodoTitle, setNewTodoTitle] = useState('')
  const [newTodoDesc, setNewTodoDesc] = useState('')
  const [newTodoPriority, setNewTodoPriority] = useState('HIGH')
  const [newTodoRole, setNewTodoRole] = useState('All Council Leads')
  const [newTodoTargetDate, setNewTodoTargetDate] = useState('')
  const [addingTodo, setAddingTodo] = useState(false)

  // Filter States
  const [filterTab, setFilterTab] = useState('ALL') // ALL, PENDING, COMPLETED
  const [priorityFilter, setPriorityFilter] = useState('ALL')

  function loadDirectives() {
    setLoadingDirectives(true)
    adminApi.getPresidentDirectives()
      .then(res => {
        setDirectivesData(res || { announcement: '', todos: [] })
        setBriefingDraft(res?.announcement || '')
      })
      .catch(() => {})
      .finally(() => setLoadingDirectives(false))
  }

  useEffect(() => {
    let mounted = true
    Promise.all([
      adminApi.listMembers().catch(() => ({ users: [] })),
      adminApi.listEvents().catch(() => ({ events: [] })),
      adminApi.listSubscriptions().catch(() => ({ stats: {} })),
      adminApi.getPresidentDirectives().catch(() => null),
    ]).then(([m, e, s, d]) => {
      if (mounted) {
        setMemberCount(m.users?.length || 0)
        setEventCount(e.events?.length || 0)
        setSubStats(s.stats || {})
        if (d) {
          setDirectivesData(d)
          setBriefingDraft(d.announcement || '')
        }
      }
    }).finally(() => {
      if (mounted) setLoadingDirectives(false)
    })
    return () => { mounted = false }
  }, [])

  async function handleSaveBriefing(e) {
    if (e) e.preventDefault()
    if (!isPresident) return
    setSavingBriefing(true)
    setDirectivesError('')
    setDirectivesMessage('')
    try {
      const updated = {
        ...directivesData,
        announcement: briefingDraft.trim(),
      }
      const res = await adminApi.updatePresidentDirectives(updated)
      setDirectivesData(res.data || updated)
      setIsEditingBriefing(false)
      setDirectivesMessage('Presidential briefing updated.')
      setTimeout(() => setDirectivesMessage(''), 3500)
    } catch (err) {
      setDirectivesError(err.message || 'Failed to update presidential briefing.')
    } finally {
      setSavingBriefing(false)
    }
  }

  async function handleToggleTodo(todoId) {
    const todos = directivesData.todos || []
    const target = todos.find(t => t.id === todoId)
    if (!target) return
    const nextCompleted = !target.completed

    // Optimistic update
    const updatedTodos = todos.map(t => t.id === todoId ? { ...t, completed: nextCompleted, completedAt: nextCompleted ? new Date().toISOString() : null, completedBy: nextCompleted ? (user.profile?.name || user.memberId) : null } : t)
    setDirectivesData(prev => ({ ...prev, todos: updatedTodos }))

    try {
      await adminApi.togglePresidentDirectiveTodo(todoId, nextCompleted)
    } catch (err) {
      // Revert if failed
      setDirectivesData(prev => ({ ...prev, todos }))
      setDirectivesError(err.message || 'Failed to update to-do status.')
    }
  }

  async function handleCreateTodo(e) {
    e.preventDefault()
    if (!isPresident) return
    if (!newTodoTitle.trim()) {
      setDirectivesError('Please enter a directive title.')
      return
    }

    setAddingTodo(true)
    setDirectivesError('')
    try {
      const newEntry = {
        id: `dir-${Date.now()}`,
        title: newTodoTitle.trim(),
        description: newTodoDesc.trim(),
        priority: newTodoPriority,
        assignedRole: newTodoRole.trim() || 'All Council Leads',
        targetDate: newTodoTargetDate.trim() || 'As Scheduled',
        completed: false,
        createdAt: new Date().toISOString(),
      }
      const updatedTodos = [newEntry, ...(directivesData.todos || [])]
      const payload = {
        ...directivesData,
        todos: updatedTodos,
      }
      const res = await adminApi.updatePresidentDirectives(payload)
      setDirectivesData(res.data || payload)
      setShowAddTodoModal(false)
      setNewTodoTitle('')
      setNewTodoDesc('')
      setNewTodoPriority('HIGH')
      setNewTodoRole('All Council Leads')
      setNewTodoTargetDate('')
      setDirectivesMessage('New Presidential directive published.')
      setTimeout(() => setDirectivesMessage(''), 3500)
    } catch (err) {
      setDirectivesError(err.message || 'Failed to create directive to-do.')
    } finally {
      setAddingTodo(false)
    }
  }

  async function handleDeleteTodo(todoId) {
    if (!isPresident) return
    if (!window.confirm('Delete this Presidential directive to-do?')) return
    const filtered = (directivesData.todos || []).filter(t => t.id !== todoId)
    try {
      const payload = {
        ...directivesData,
        todos: filtered,
      }
      const res = await adminApi.updatePresidentDirectives(payload)
      setDirectivesData(res.data || payload)
      setDirectivesMessage('Directive removed.')
      setTimeout(() => setDirectivesMessage(''), 3000)
    } catch (err) {
      setDirectivesError(err.message || 'Failed to delete directive.')
    }
  }

  // Filtered To-dos
  const allTodos = directivesData.todos || []
  const filteredTodos = allTodos.filter(item => {
    if (filterTab === 'PENDING' && item.completed) return false
    if (filterTab === 'COMPLETED' && !item.completed) return false
    if (priorityFilter !== 'ALL' && item.priority !== priorityFilter) return false
    return true
  })

  const pendingCount = allTodos.filter(t => !t.completed).length
  const completedCount = allTodos.filter(t => t.completed).length

  return (
    <LivePortal user={user} logout={logout} activeTab="admin-dashboard" onNavigate={onNavigate} title="COMMAND CENTER">
      <section className="welcome admin-welcome">
        <div>
          <p className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Icon8 name="protect" size={14} /> PRESIDENTIAL COMMAND CENTER
          </p>
          <h1>Welcome, {user.name}.</h1>
          <p>{getRoleLabel(user.role)} Command Center · Operational directives, task dispatch, and club access controls.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="outline" type="button" onClick={() => onNavigate('admin-qr-scanner')} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 16px', fontSize: '11px', fontWeight: 700 }}>
            <Icon8 name="faceId" size={17} /> QR ENTRY GATE
          </button>
          <button className="primary" type="button" onClick={() => onNavigate('admin-events')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 16px', fontSize: '11px', fontWeight: 700 }}>
            <span style={{ fontSize: '15px', lineHeight: 1 }}>+</span> CREATE EVENT
          </button>
        </div>
      </section>

      {/* Pending Subscriptions Alert */}
      {subStats.pendingVerification > 0 && (
        <div className="pending-alert-banner" style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <IconAlertTriangle size={22} style={{ color: '#f59e0b', flexShrink: 0 }} />
            <div>
              <b>{subStats.pendingVerification} student subscription payments waiting for verification</b>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#ffecb3' }}>
                Review and activate memberships to unlock event passes for students.
              </p>
            </div>
          </div>
          <button type="button" onClick={() => onNavigate('admin-subscriptions')}>
            REVIEW PAYMENTS &rarr;
          </button>
        </div>
      )}

      {/* Top Metrics Cards */}
      <section className="stats" style={{ margin: '20px 0 28px' }}>
        <div className="stat" onClick={() => onNavigate('admin-members')} style={{ cursor: 'pointer' }}>
          <i><Icon8 name="idDocs" size={26} /></i>
          <div>
            <p>MEMBERS</p>
            <h2>{memberCount === null ? '...' : memberCount}</h2>
            <small>Registered Accounts</small>
          </div>
        </div>

        <div className="stat" onClick={() => onNavigate('admin-events')} style={{ cursor: 'pointer' }}>
          <i><Icon8 name="realtime" size={26} /></i>
          <div>
            <p>EVENTS</p>
            <h2>{eventCount === null ? '...' : eventCount}</h2>
            <small>Club Catalog</small>
          </div>
        </div>

        <div className="stat green" onClick={() => onNavigate('admin-subscriptions')} style={{ cursor: 'pointer' }}>
          <i><Icon8 name="access" size={26} /></i>
          <div>
            <p>ACTIVE SUBSCRIPTIONS</p>
            <h2>{subStats.activeSubscriptions || 0}</h2>
            <small>Verified Members</small>
          </div>
        </div>

        <div className="stat green">
          <i><Icon8 name="protect" size={26} /></i>
          <div>
            <p>SYSTEM ROLE</p>
            <h2>{user.isPrimaryAdmin ? 'PRIMARY' : user.role.slice(0, 7)}</h2>
            <small>{getRoleLabel(user.role)}</small>
          </div>
        </div>
      </section>

      {directivesMessage && <p className="member-form-success" style={{ marginBottom: '16px' }}>{directivesMessage}</p>}
      {directivesError && <p className="member-form-error" style={{ marginBottom: '16px' }}>{directivesError}</p>}

      {/* ---------------------------------------------------- */}
      {/* PRIMARY PRESIDENT INSTRUCTIONS & DIRECTIVES SECTION */}
      {/* ---------------------------------------------------- */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
        
        {/* Presidential Command Broadcast Briefing Card */}
        <article className="member-list-card" style={{ padding: '24px', background: 'var(--panel-bg)', borderRadius: '16px', border: '1px solid var(--brand-border-subtle)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ display: 'inline-flex', padding: '8px', borderRadius: '10px', background: 'var(--brand-glow)', color: 'var(--brand-primary)' }}>
                <Icon8 name="protect" size={20} />
              </span>
              <div>
                <span className="badge badge-president" style={{ fontSize: '10px', letterSpacing: '0.06em', padding: '2px 8px' }}>
                  PRIMARY PRESIDENT DIRECTIVE
                </span>
                <h3 style={{ font: '700 18px Syne', color: 'var(--text-main)', margin: '4px 0 0' }}>
                  Executive Orders & Operational Briefing
                </h3>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {directivesData.updatedAt && (
                <small style={{ color: 'var(--text-dim)', fontSize: '11px', fontFamily: 'monospace' }}>
                  Updated: {new Date(directivesData.updatedAt).toLocaleDateString()} by {directivesData.updatedBy || 'President'}
                </small>
              )}
              {isPresident && !isEditingBriefing && (
                <button
                  type="button"
                  className="outline"
                  onClick={() => { setIsEditingBriefing(true); setBriefingDraft(directivesData.announcement || '') }}
                  style={{ fontSize: '11px', padding: '6px 14px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Icon8 name="keySecurity" size={13} /> EDIT BRIEFING
                </button>
              )}
            </div>
          </div>

          {isEditingBriefing ? (
            <form onSubmit={handleSaveBriefing} style={{ marginTop: '12px' }}>
              <textarea
                rows={4}
                value={briefingDraft}
                onChange={e => setBriefingDraft(e.target.value)}
                placeholder="Enter official instructions, guidance, operational protocols, or focus directives for all council members and administrators..."
                style={{
                  width: '100%',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--line)',
                  borderRadius: '10px',
                  color: 'var(--text-main)',
                  padding: '12px',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  resize: 'vertical',
                }}
              />
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="action-btn"
                  onClick={() => setIsEditingBriefing(false)}
                  disabled={savingBriefing}
                  style={{ padding: '6px 14px', fontSize: '11px', background: 'var(--panel-subtle)', color: 'var(--text-main)', border: '1px solid var(--line)' }}
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="primary"
                  disabled={savingBriefing}
                  style={{ padding: '6px 18px', fontSize: '11px', fontWeight: 700 }}
                >
                  {savingBriefing ? 'SAVING BRIEFING…' : 'PUBLISH BRIEFING'}
                </button>
              </div>
            </form>
          ) : (
            <div style={{ background: 'var(--panel-subtle)', borderRadius: '12px', padding: '16px 20px', border: '1px solid var(--line)', marginTop: '6px' }}>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-main)', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>
                {directivesData.announcement || 'No presidential briefing active. The Primary President can publish operational directives using the button above.'}
              </p>
            </div>
          )}
        </article>

        {/* Presidential Action Directives / To-Dos Command Board */}
        <article className="member-list-card" style={{ padding: '24px', background: 'var(--panel-bg)', borderRadius: '16px', border: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
            <div>
              <p className="eyebrow" style={{ margin: '0 0 4px', fontSize: '10px', color: 'var(--brand-primary)', letterSpacing: '0.06em' }}>
                COUNCIL ACTION ITEMS & DIRECTIVES
              </p>
              <h2 style={{ font: '700 20px Syne', color: 'var(--text-main)', margin: 0 }}>
                Primary President To-Do Directives
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                {isPresident
                  ? 'Official tasks and assignments issued exclusively by you to lead coordinators and admins.'
                  : 'Official tasks and directives assigned by the Primary President. Check off tasks when completed.'}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              {isPresident && (
                <button
                  type="button"
                  className="primary"
                  onClick={() => setShowAddTodoModal(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '8px 16px', fontWeight: 700 }}
                >
                  <span style={{ fontSize: '15px', lineHeight: 1 }}>+</span> ADD DIRECTIVE / TASK
                </button>
              )}
            </div>
          </div>

          {/* Filter & Metric Strip */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', borderBottom: '1px solid var(--line)', paddingBottom: '12px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setFilterTab('ALL')}
                style={{
                  fontSize: '11px',
                  padding: '5px 12px',
                  borderRadius: '20px',
                  border: '1px solid var(--line)',
                  background: filterTab === 'ALL' ? 'var(--brand-primary)' : 'var(--bg-input)',
                  color: filterTab === 'ALL' ? '#000' : 'var(--text-main)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                All Directives ({allTodos.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('PENDING')}
                style={{
                  fontSize: '11px',
                  padding: '5px 12px',
                  borderRadius: '20px',
                  border: '1px solid var(--line)',
                  background: filterTab === 'PENDING' ? 'var(--brand-primary)' : 'var(--bg-input)',
                  color: filterTab === 'PENDING' ? '#000' : 'var(--text-main)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Pending ({pendingCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('COMPLETED')}
                style={{
                  fontSize: '11px',
                  padding: '5px 12px',
                  borderRadius: '20px',
                  border: '1px solid var(--line)',
                  background: filterTab === 'COMPLETED' ? 'var(--brand-primary)' : 'var(--bg-input)',
                  color: filterTab === 'COMPLETED' ? '#000' : 'var(--text-main)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Completed ({completedCount})
              </button>
            </div>

            <div>
              <select
                value={priorityFilter}
                onChange={e => setPriorityFilter(e.target.value)}
                style={{ height: '32px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text-main)', padding: '0 10px', fontSize: '11px' }}
              >
                <option value="ALL">All Priorities</option>
                <option value="CRITICAL">Critical Priority</option>
                <option value="HIGH">High Priority</option>
                <option value="MEDIUM">Medium Priority</option>
                <option value="ROUTINE">Routine Priority</option>
              </select>
            </div>
          </div>

          {/* Directives List */}
          {loadingDirectives ? (
            <p className="directory-state">Loading presidential directives...</p>
          ) : filteredTodos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--panel-subtle)', borderRadius: '12px', border: '1px dashed var(--line)' }}>
              <Icon8 name="protect" size={32} style={{ color: 'var(--brand-primary)', opacity: 0.7, marginBottom: '8px' }} />
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
                {filterTab === 'ALL' ? 'No directives issued yet.' : `No ${filterTab.toLowerCase()} directives found.`}
              </p>
              {isPresident && (
                <button
                  type="button"
                  className="primary"
                  onClick={() => setShowAddTodoModal(true)}
                  style={{ marginTop: '12px', fontSize: '11px', padding: '6px 14px' }}
                >
                  CREATE FIRST DIRECTIVE
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredTodos.map(todo => {
                const isCritical = todo.priority === 'CRITICAL'
                const isHigh = todo.priority === 'HIGH'
                const isMedium = todo.priority === 'MEDIUM'

                const priorityBadgeStyle = isCritical
                  ? { background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)' }
                  : isHigh
                  ? { background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)' }
                  : isMedium
                  ? { background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.4)' }
                  : { background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.4)' }

                return (
                  <div
                    key={todo.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '14px',
                      padding: '16px 18px',
                      borderRadius: '12px',
                      background: todo.completed ? 'rgba(0, 0, 0, 0.2)' : 'var(--bg-input)',
                      border: todo.completed ? '1px solid var(--line)' : '1px solid var(--brand-border-subtle)',
                      transition: 'all 0.2s ease',
                      opacity: todo.completed ? 0.75 : 1,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flex: 1 }}>
                      {/* Checkbox */}
                      <button
                        type="button"
                        onClick={() => handleToggleTodo(todo.id)}
                        style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '6px',
                          border: todo.completed ? '2px solid #10b981' : '2px solid var(--line)',
                          background: todo.completed ? '#10b981' : 'transparent',
                          color: '#000',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          marginTop: '2px',
                          flexShrink: 0,
                          fontSize: '12px',
                          fontWeight: 800,
                          padding: 0,
                        }}
                        title={todo.completed ? 'Mark pending' : 'Mark completed'}
                      >
                        {todo.completed ? '✓' : ''}
                      </button>

                      {/* Content */}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                          <span className="badge" style={{ fontSize: '9px', padding: '1px 7px', ...priorityBadgeStyle }}>
                            {todo.priority || 'ROUTINE'}
                          </span>
                          <span className="badge" style={{ fontSize: '9px', padding: '1px 7px', background: 'var(--panel-subtle)', color: 'var(--text-main)', border: '1px solid var(--line)' }}>
                            {todo.assignedRole || 'All Council Leads'}
                          </span>
                          {todo.targetDate && (
                            <small style={{ color: 'var(--brand-primary)', fontSize: '10px', fontFamily: 'monospace' }}>
                              Due: {todo.targetDate}
                            </small>
                          )}
                        </div>

                        <b style={{
                          fontSize: '14px',
                          color: todo.completed ? 'var(--text-muted)' : 'var(--text-main)',
                          textDecoration: todo.completed ? 'line-through' : 'none',
                          display: 'block',
                        }}>
                          {todo.title}
                        </b>

                        {todo.description && (
                          <p style={{
                            margin: '4px 0 0',
                            fontSize: '12px',
                            color: 'var(--text-dim)',
                            lineHeight: '1.5',
                            textDecoration: todo.completed ? 'line-through' : 'none',
                          }}>
                            {todo.description}
                          </p>
                        )}

                        {todo.completed && todo.completedBy && (
                          <small style={{ display: 'block', marginTop: '6px', color: '#10b981', fontSize: '10px' }}>
                            ✓ Marked complete by {todo.completedBy} {todo.completedAt ? `· ${new Date(todo.completedAt).toLocaleString()}` : ''}
                          </small>
                        )}
                      </div>
                    </div>

                    {/* President Controls */}
                    {isPresident && (
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => handleDeleteTodo(todo.id)}
                          style={{
                            background: 'transparent',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: '#f87171',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            fontSize: '10px',
                            cursor: 'pointer',
                          }}
                          title="Delete directive"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </article>
      </section>

      {/* Add Directive Modal (Primary President Only) */}
      {showAddTodoModal && isPresident && (
        <div className="photo-lightbox" onClick={() => setShowAddTodoModal(false)}>
          <div className="photo-lightbox-content" onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-modal)', padding: '28px', borderRadius: '16px', border: '1px solid var(--line)', maxWidth: '520px', width: '92vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icon8 name="protect" size={20} />
                <h3 style={{ font: '700 18px Syne', color: 'var(--text-main)', margin: 0 }}>
                  Issue Presidential Directive / Task
                </h3>
              </div>
              <button className="lightbox-close" onClick={() => setShowAddTodoModal(false)} style={{ position: 'static' }}>✕</button>
            </div>

            <form onSubmit={handleCreateTodo} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="field-label" style={{ fontSize: '11px' }}>Directive Title *</label>
                <input
                  required
                  placeholder="e.g. Audit Hall 4 Audio Equipment & Test Scanners"
                  value={newTodoTitle}
                  onChange={e => setNewTodoTitle(e.target.value)}
                  style={{ width: '100%', height: '38px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text-main)', padding: '0 10px', fontSize: '12px' }}
                />
              </div>

              <div>
                <label className="field-label" style={{ fontSize: '11px' }}>Directive Instructions / Details</label>
                <textarea
                  rows={3}
                  placeholder="Detailed specifications, safety instructions, or team requirements..."
                  value={newTodoDesc}
                  onChange={e => setNewTodoDesc(e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text-main)', padding: '10px', fontSize: '12px', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="field-label" style={{ fontSize: '11px' }}>Priority Level</label>
                  <select
                    value={newTodoPriority}
                    onChange={e => setNewTodoPriority(e.target.value)}
                    style={{ width: '100%', height: '38px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text-main)', padding: '0 10px', fontSize: '12px' }}
                  >
                    <option value="CRITICAL">Critical (Immediate)</option>
                    <option value="HIGH">High Priority</option>
                    <option value="MEDIUM">Medium Priority</option>
                    <option value="ROUTINE">Routine Task</option>
                  </select>
                </div>

                <div>
                  <label className="field-label" style={{ fontSize: '11px' }}>Assigned Council Wing</label>
                  <select
                    value={newTodoRole}
                    onChange={e => setNewTodoRole(e.target.value)}
                    style={{ width: '100%', height: '38px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text-main)', padding: '0 10px', fontSize: '12px' }}
                  >
                    <option value="All Council Leads">All Council Leads</option>
                    <option value="Event Management">Event Management</option>
                    <option value="PR & Media Team">PR & Media Team</option>
                    <option value="Technical Lead">Technical Leads</option>
                    <option value="Treasurer">Treasury & Logistics</option>
                    <option value="Security & Gate Team">Security & Gate Team</option>
                    <option value="Vice President">Vice President</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="field-label" style={{ fontSize: '11px' }}>Target Completion Deadline</label>
                <input
                  placeholder="e.g. Friday 4:00 PM / 24h Before Fest / Daily EOD"
                  value={newTodoTargetDate}
                  onChange={e => setNewTodoTargetDate(e.target.value)}
                  style={{ width: '100%', height: '38px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text-main)', padding: '0 10px', fontSize: '12px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button
                  type="button"
                  className="action-btn"
                  onClick={() => setShowAddTodoModal(false)}
                  disabled={addingTodo}
                  style={{ flex: 1, height: '40px', background: 'var(--panel-subtle)', color: 'var(--text-main)', border: '1px solid var(--line)', fontSize: '11px' }}
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="primary"
                  disabled={addingTodo}
                  style={{ flex: 2, height: '40px', fontSize: '11px', fontWeight: 700 }}
                >
                  {addingTodo ? 'PUBLISHING DIRECTIVE…' : 'PUBLISH DIRECTIVE'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </LivePortal>
  )
}

// ----------------------------------------------------
// ----------------------------------------------------
// Student Member Hub (Student Dashboard)
// ----------------------------------------------------
function LiveStudentDashboard({ user, logout, onNavigate }) {
  const { platformMode, reelsEnabled, clubSettings: sharedClubSettings } = usePlatformTheme()
  const isMrdu = platformMode === 'MRDU_EVENTS'
  const [events, setEvents] = useState([])
  const [subStatus, setSubStatus] = useState(null)
  const [clubSettings, setClubSettings] = useState(() => sharedClubSettings)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    Promise.all([
      memberApi.listEvents().catch(() => ({ events: [] })),
      memberApi.getSubscriptionStatus().catch(() => null),
      memberApi.getPublicClubSettings().catch(() => ({ settings: null })),
    ]).then(([e, s, cs]) => {
      if (mounted) {
        setEvents(e.events || [])
        setSubStatus(s)
        setClubSettings(cs?.settings || null)
      }
    }).finally(() => {
      if (mounted) setLoading(false)
    })
    return () => { mounted = false }
  }, [])

  const needsSubscription = subStatus?.subscriptionEnabled && !subStatus?.hasActiveSubscription && !subStatus?.isExempt

  // Time-based professional greeting
  const hour = new Date().getHours()
  const timeGreeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening'

  return (
    <LivePortal user={user} logout={logout} activeTab="student-dashboard" onNavigate={onNavigate} title={isMrdu ? 'MRDU EVENTS CENTRAL HUB' : 'STUDENT MEMBER HUB'}>
      {/* High-Tech Command Hero HUD */}
      <section
        className="welcome"
        style={{
          background: isMrdu ? 'linear-gradient(135deg, rgba(211, 47, 47, 0.08) 0%, rgba(56, 13, 13, 0.6) 100%)' : 'linear-gradient(135deg, rgba(82, 187, 245, 0.08) 0%, rgba(13, 31, 56, 0.6) 100%)',
          border: '1px solid var(--brand-border-subtle)',
          borderRadius: '18px',
          padding: '32px 28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '20px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'relative', zIndex: 2, maxWidth: '640px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <span className="badge" style={{ background: 'var(--brand-badge-bg)', color: 'var(--brand-primary)', border: '1px solid var(--brand-border-subtle)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em' }}>
              {isMrdu ? 'MALLA REDDY UNIVERSITY' : 'DEPARTMENT OF CYBER SECURITY'}
            </span>
            <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', fontSize: '10px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <IconShieldCheck size={12} /> VERIFIED STUDENT ACCOUNT
            </span>
          </div>

          <h1 style={{ margin: '0 0 8px', fontSize: '26px', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            {timeGreeting}, {user.name}
          </h1>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            {isMrdu
              ? 'Welcome to the official MRDU central events portal. Access digital passes, register for technical summits, and watch campus reels.'
              : 'Welcome to the Cyber Security Club portal. Access CTF sandboxes, workshop passes, exclusive campus reels, and technical mentor support.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', zIndex: 2 }}>
          <button
            type="button"
            className="primary"
            onClick={() => onNavigate('student-events')}
            style={{ fontSize: '12px', padding: '10px 18px', fontWeight: 700, letterSpacing: '0.04em' }}
          >
            EXPLORE EVENTS CATALOG →
          </button>
          <button
            type="button"
            className="outline"
            onClick={() => onNavigate('student-passes')}
            style={{ fontSize: '12px', padding: '10px 18px', fontWeight: 700 }}
          >
            DIGITAL PASS WALLET
          </button>
        </div>
      </section>

      {/* Subscription Notice Banner */}
      {subStatus?.subscriptionEnabled && needsSubscription && (
        <div className="pending-alert-banner" style={{ marginTop: '20px', background: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.4)', color: '#fef3c7', borderRadius: '12px', padding: '16px 20px' }}>
          <div>
            <b style={{ color: '#f59e0b', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <IconAlertTriangle size={14} /> {isMrdu ? 'Student Event Pass Inactive' : 'Student Club Membership Inactive'}
            </b>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
              Subscribe (₹{subStatus?.monthlyAmount || 100}/mo via UPI) to unlock event registrations, digital pass wallet, and technical support desk.
            </p>
          </div>
          <button type="button" onClick={() => onNavigate('student-membership')} style={{ background: '#f59e0b', color: '#000', fontWeight: 700, fontSize: '11px', padding: '8px 16px', borderRadius: '6px', border: 0, cursor: 'pointer' }}>
            ACTIVATE NOW →
          </button>
        </div>
      )}

      {/* 4 Interactive Metric HUD Cards */}
      <section className="stats" style={{ margin: '24px 0', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="stat" onClick={() => onNavigate('student-events')} style={{ cursor: 'pointer', borderRadius: '14px', border: '1px solid var(--brand-border-subtle)' }}>
          <i><IconSparkles size={24} style={{ color: 'var(--brand-primary)' }} /></i>
          <div>
            <p>{isMrdu ? 'UNIVERSITY EVENTS' : 'CLUB EVENTS'}</p>
            <h2>{events.length}</h2>
            <small>{isMrdu ? 'Active Summits & Fests' : 'Live Workshops & CTFs'}</small>
          </div>
        </div>

        <div className="stat" onClick={() => onNavigate('student-passes')} style={{ cursor: 'pointer', borderRadius: '14px', border: '1px solid var(--brand-border-subtle)' }}>
          <i><Icon8 name="idDocs" size={24} /></i>
          <div>
            <p>{isMrdu ? 'MY EVENT PASSES' : 'MY PASSES'}</p>
            <h2>{events.filter(e => e.isRegistered).length}</h2>
            <small>Confirmed Registrations</small>
          </div>
        </div>

        {subStatus?.subscriptionEnabled ? (
          <div className={`stat ${subStatus?.hasActiveSubscription ? 'green' : 'amber'}`} onClick={() => onNavigate('student-membership')} style={{ cursor: 'pointer', borderRadius: '14px' }}>
            <i><Icon8 name="access" size={24} /></i>
            <div>
              <p>{isMrdu ? 'STUDENT PASS' : 'MEMBERSHIP'}</p>
              <h2>{subStatus?.hasActiveSubscription ? 'ACTIVE' : 'INACTIVE'}</h2>
              <small>{subStatus?.hasActiveSubscription ? 'Verified Account' : 'UPI Payment Required'}</small>
            </div>
          </div>
        ) : (
          <div className="stat green" style={{ borderRadius: '14px' }}>
            <i><IconShieldCheck size={24} style={{ color: '#10b981' }} /></i>
            <div>
              <p>DEPARTMENT & YEAR</p>
              <h2>{user.profile?.department || 'CSE'}</h2>
              <small>{user.profile?.year ? `Year ${user.profile.year} · Verified` : 'Enrolled Student'}</small>
            </div>
          </div>
        )}

        <div className="stat green" style={{ borderRadius: '14px' }}>
          <i><Icon8 name="fingerprint" size={24} /></i>
          <div>
            <p>{isMrdu ? 'STUDENT ID' : 'MEMBER ID'}</p>
            <h2>{user.memberId}</h2>
            <small>Roll / Authorized ID</small>
          </div>
        </div>
      </section>

      {/* Quick Command Hub Grid (6 Interactive Tiles) */}
      <div style={{ marginBottom: '32px' }}>
        <p className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
          <Icon8 name="access" size={14} /> QUICK COMMAND HUB
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
          <div
            onClick={() => onNavigate('student-passes')}
            className="account-form-card"
            style={{
              padding: '16px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              borderRadius: '12px',
              border: '1px solid var(--brand-border-subtle)',
              transition: 'all 0.2s ease',
            }}
          >
            <span style={{ display: 'inline-flex', padding: '10px', borderRadius: '10px', background: 'var(--brand-badge-bg)', color: 'var(--brand-primary)', width: 'fit-content' }}>
              <IconCreditCard size={18} />
            </span>
            <b style={{ fontSize: '13px', color: 'var(--text-main)' }}>Digital Pass Wallet</b>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>View QR boarding passes & download printable IDs.</p>
          </div>

          {reelsEnabled && (
            <div
              onClick={() => onNavigate('student-reels')}
              className="account-form-card"
              style={{
                padding: '16px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                borderRadius: '12px',
                border: '1px solid var(--brand-border-subtle)',
                transition: 'all 0.2s ease',
              }}
            >
              <span style={{ display: 'inline-flex', padding: '10px', borderRadius: '10px', background: 'rgba(236, 72, 153, 0.12)', color: '#ec4899', width: 'fit-content' }}>
                <IconVideo size={18} />
              </span>
              <b style={{ fontSize: '13px', color: 'var(--text-main)' }}>Campus Reels</b>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>Short-form video highlights, CTF demos & event teasers.</p>
            </div>
          )}

          <div
            onClick={() => onNavigate('student-events')}
            className="account-form-card"
            style={{
              padding: '16px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              borderRadius: '12px',
              border: '1px solid var(--brand-border-subtle)',
              transition: 'all 0.2s ease',
            }}
          >
            <span style={{ display: 'inline-flex', padding: '10px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', width: 'fit-content' }}>
              <IconCalendar size={18} />
            </span>
            <b style={{ fontSize: '13px', color: 'var(--text-main)' }}>Events Catalog</b>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>Register for upcoming hackathons, labs, and summits.</p>
          </div>

          <div
            onClick={() => onNavigate('student-complaints')}
            className="account-form-card"
            style={{
              padding: '16px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              borderRadius: '12px',
              border: '1px solid var(--brand-border-subtle)',
              transition: 'all 0.2s ease',
            }}
          >
            <span style={{ display: 'inline-flex', padding: '10px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', width: 'fit-content' }}>
              <IconHeadset size={18} />
            </span>
            <b style={{ fontSize: '13px', color: 'var(--text-main)' }}>24/7 Doubt Desk</b>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>Submit queries, get technical support & mentor guidance.</p>
          </div>

          <div
            onClick={() => onNavigate('student-gallery')}
            className="account-form-card"
            style={{
              padding: '16px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              borderRadius: '12px',
              border: '1px solid var(--brand-border-subtle)',
              transition: 'all 0.2s ease',
            }}
          >
            <span style={{ display: 'inline-flex', padding: '10px', borderRadius: '10px', background: 'rgba(168, 85, 247, 0.12)', color: '#a855f7', width: 'fit-content' }}>
              <IconSparkles size={18} />
            </span>
            <b style={{ fontSize: '13px', color: 'var(--text-main)' }}>Photo Gallery</b>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>Browse high-resolution event albums and campus fests.</p>
          </div>

          <div
            onClick={() => onNavigate('student-team')}
            className="account-form-card"
            style={{
              padding: '16px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              borderRadius: '12px',
              border: '1px solid var(--brand-border-subtle)',
              transition: 'all 0.2s ease',
            }}
          >
            <span style={{ display: 'inline-flex', padding: '10px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', width: 'fit-content' }}>
              <IconUserSvg size={18} />
            </span>
            <b style={{ fontSize: '13px', color: 'var(--text-main)' }}>Club Council</b>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>Connect with student leads, office bearers, and mentors.</p>
          </div>
        </div>
      </div>

      {/* Featured Sessions & Events Catalog */}
      <div className="section-title">
        <div>
          <p className="eyebrow">{isMrdu ? 'CAMPUS HIGHLIGHTS' : 'FEATURED SESSIONS'}</p>
          <h2>{isMrdu ? 'Featured University Events' : 'Upcoming Club Events'}</h2>
        </div>
        <button type="button" onClick={() => onNavigate('student-events')}>EXPLORE ALL &nbsp;→</button>
      </div>

      {loading ? (
        <p className="directory-state">Loading events...</p>
      ) : events.length === 0 ? (
        <p className="directory-state">No published events currently. Check back soon!</p>
      ) : (
        <div className="student-events-container">
          {events.slice(0, 3).map(evt => (
            <article key={evt.id} className="live-event-card">
              <div className="event-banner">
                {evt.photoUrl ? (
                  <img src={evt.photoUrl} alt={evt.title} />
                ) : (
                  <div className="event-banner-fallback">
                    <strong>{evt.eventType.toUpperCase()}</strong>
                  </div>
                )}
                <span className="event-badge-overlay">{evt.eventType}</span>
              </div>
              <div className="card-content">
                <h3>{evt.title}</h3>
                <p>{evt.shortDescription || evt.description || (isMrdu ? 'MRDU University official event session.' : 'Department of Cyber Security official session.')}</p>
                <div className="card-meta">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><IconCalendar size={13} /> {new Date(evt.dateTime).toLocaleDateString()}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><IconLocationPin size={13} /> {evt.venue || evt.location || 'Campus'}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><IconCreditCard size={13} /> {evt.requiresPayment ? `₹${evt.paymentAmount || 'Tiered'}` : 'FREE'}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><IconUserSvg size={13} /> {evt.registrationCount || 0} registered</span>
                </div>
                <div className="card-footer">
                  {evt.isRegistered ? (
                    <span className="badge badge-registered" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <IconShieldCheck size={13} /> REGISTERED
                    </span>
                  ) : (
                    <button className="register-btn" type="button" onClick={() => onNavigate(`event-detail/${evt.id}`)}>
                      VIEW & REGISTER &rarr;
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Sleek Official About & Channels Section at the Bottom */}
      <footer
        style={{
          marginTop: '48px',
          padding: '28px 24px',
          background: 'var(--panel-subtle)',
          border: '1px solid var(--line)',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
          <div style={{ maxWidth: '580px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={{ color: 'var(--brand-primary)', display: 'inline-flex' }}>
                {isMrdu ? <IconSparkles size={16} /> : <IconShieldCheck size={16} />}
              </span>
              <b style={{ color: 'var(--text-main)', fontSize: '14px' }}>
                {isMrdu ? 'About Malla Reddy University Events Portal' : 'About Cyber Security Club · MRDU'}
              </b>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.6, margin: 0 }}>
              {isMrdu
                ? 'Malla Reddy (Deemed to be University) · NAAC A++ Accredited. The central gateway for university workshops, national symposiums, hackathons, and multi-department student initiatives.'
                : 'The official student cyber defense organisation at Malla Reddy University. Advancing ethical hacking, live CTF competitions, security research, and student technical empowerment.'}
            </p>
          </div>

          {/* Quick Support & Helpline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <small style={{ color: 'var(--text-dim)', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>
              Official Student Support
            </small>
            <a
              href={`mailto:${clubSettings?.contactEmail || 'cybersecurityclub@mrdu.edu'}`}
              style={{ color: 'var(--brand-primary)', fontSize: '12px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <IconMail size={13} /> {clubSettings?.contactEmail || 'cybersecurityclub@mrdu.edu'}
            </a>
            {clubSettings?.technicalSupportEmail && (
              <a
                href={`mailto:${clubSettings.technicalSupportEmail}`}
                style={{ color: 'var(--text-muted)', fontSize: '11.5px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <IconHeadset size={13} /> {clubSettings.technicalSupportEmail}
              </a>
            )}
          </div>
        </div>

        {/* Inline Social Icons & Links Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', paddingTop: '16px', borderTop: '1px solid var(--line)' }}>
          <small style={{ color: 'var(--text-dim)', fontSize: '11px' }}>
            © {new Date().getFullYear()} {isMrdu ? 'Malla Reddy University' : 'Cyber Security Club'}. All rights reserved.
          </small>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            {clubSettings?.instagramUrl && (
              <a
                href={clubSettings.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--text-muted)', fontSize: '12px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', transition: 'color 0.15s ease' }}
              >
                <IconInstagram size={14} /> Instagram
              </a>
            )}
            {clubSettings?.youtubeUrl && (
              <a
                href={clubSettings.youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--text-muted)', fontSize: '12px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', transition: 'color 0.15s ease' }}
              >
                <IconYouTube size={14} /> YouTube
              </a>
            )}
            {(clubSettings?.whatsappUrl || clubSettings?.discordUrl) && (
              <a
                href={clubSettings.whatsappUrl || clubSettings.discordUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--text-muted)', fontSize: '12px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', transition: 'color 0.15s ease' }}
              >
                {clubSettings.whatsappUrl ? <IconWhatsApp size={14} /> : <IconDiscord size={14} />} Community
              </a>
            )}
            {clubSettings?.githubUrl && (
              <a
                href={clubSettings.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--text-muted)', fontSize: '12px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', transition: 'color 0.15s ease' }}
              >
                <IconGitHub size={14} /> GitHub
              </a>
            )}
          </div>
        </div>
      </footer>
    </LivePortal>
  )
}

// ----------------------------------------------------
// Security Audit Log View (Categorized, Clean & Details Modal)
// ----------------------------------------------------
function getAuditCategory(action = '') {
  const a = action.toUpperCase()
  if (a.includes('PAYMENT') || a.includes('SUBSCRIPTION') || a.includes('FEE')) return 'PAYMENTS'
  if (a.includes('LOGIN') || a.includes('LOGOUT') || a.includes('AUTH') || a.includes('2FA') || a.includes('PASSWORD') || a.includes('PIN')) return 'AUTH'
  if (a.includes('MEMBER') || a.includes('ROLE') || a.includes('STATUS') || a.includes('ACCOUNT')) return 'MEMBERS'
  if (a.includes('EVENT') || a.includes('REGISTRATION') || a.includes('PASS')) return 'EVENTS'
  if (a.includes('SETTING') || a.includes('HIBERNATION') || a.includes('VIDEO') || a.includes('CONFIG') || a.includes('SUPPORT')) return 'SYSTEM'
  return 'GENERAL'
}

function getCategoryBadge(cat, isMrdu = false) {
  switch (cat) {
    case 'PAYMENTS': return { label: 'Payments', color: '#70ddb4', bg: '#10382e' }
    case 'AUTH': return isMrdu
      ? { label: 'Auth', color: '#ff9a9a', bg: 'rgba(211,47,47,0.15)' }
      : { label: 'Auth', color: '#52bbf5', bg: '#164366' }
    case 'MEMBERS': return { label: 'Members', color: '#d5baff', bg: '#382766' }
    case 'EVENTS': return { label: 'Events', color: '#ffb74d', bg: '#3a2a10' }
    case 'SYSTEM': return { label: 'System', color: '#f87171', bg: '#3a1818' }
    default: return { label: 'General', color: '#8aa2b4', bg: '#182433' }
  }
}

const AUDIT_ACTION_TITLES = {
  EVENT_ENTRY_GRANTED: 'Event Gate Entry & Attendance Checked In',
  EVENT_PAYMENT_VERIFIED: 'Event Pass Payment Verified',
  PASS_PAYMENT_VERIFIED: 'Event Pass Payment Verified',
  EVENT_CREATED: 'New Event Created & Published',
  EVENT_UPDATED: 'Event Schedule & Details Updated',
  EVENT_DELETED: 'Event Deleted',
  EVENT_REGISTERED: 'Student Event Registration Submitted',
  TEAM_INVITE_SENT: 'Team Squad Invitation Dispatched',
  TEAM_INVITE_RESPONDED: 'Team Squad Invitation Response',
  ACCOUNT_CREATED: 'New Member Account Provisioned',
  GUEST_REGISTERED: 'Guest Student Registered Account',
  BULK_STUDENTS_CREATED: 'Batch Student Accounts Provisioned',
  ACCOUNT_STATUS_CHANGED: 'Member Account Access Status Changed',
  ACCOUNT_AUTO_DISABLED_INACTIVITY: 'Account Auto-Disabled (Inactivity > 3 Days)',
  ACCOUNT_PERMISSIONS_CHANGED: 'Administrative Permissions Updated',
  ACCOUNT_UPDATED: 'Member Profile Information Updated',
  ADMIN_PASSWORD_RESET: 'Member Password Reset by Administrator',
  TWO_FACTOR_RESET_BY_ADMIN: 'Member 2FA Reset by Administrator',
  MEMBER_DELETED: 'Member Account Deleted',
  PRIMARY_PRESIDENT_LOGIN_SUCCESS: 'Primary President Sign-in',
  PRESIDENT_LOGIN_SUCCESS: 'President Sign-in',
  LOGIN_SUCCESS: 'Member Sign-in',
  TWO_FACTOR_LOGIN_SUCCESS: '2FA Security Code Verified',
  TWO_FACTOR_LOGIN_FAILED: 'Failed 2FA Security Attempt',
  LOGOUT: 'Member Sign-out',
  LOGOUT_ALL_DEVICES: 'All Device Sessions Terminated',
  LOGIN_BLOCKED: 'Sign-in Attempt Blocked',
  ACCOUNT_LOCKED: 'Account Locked Due to Failed Attempts',
  PASSWORD_RESET_REQUESTED: 'Password Reset Requested',
  PASSWORD_RESET_COMPLETED: 'Password Reset Completed',
  TWO_FACTOR_ENABLED: 'Two-Factor Authentication Enabled',
  TWO_FACTOR_DISABLED: 'Two-Factor Authentication Disabled',
  MASTER_SECURITY_PIN_CHANGED: 'President Master Security PIN Changed',
  FULL_DATABASE_EXPORT_SQL: 'Full Database SQL Snapshot Exported',
  DATABASE_EXPORT_REJECTED_INVALID_PASSWORD: 'Database Export Blocked (Invalid Password)',
  GALLERY_ALBUM_CREATED: 'New Photo Gallery Album Created',
  GALLERY_PHOTO_ADDED: 'Photo Uploaded to Gallery',
  GALLERY_PHOTOS_ADDED: 'Batch Photos Uploaded to Gallery',
  GALLERY_PHOTO_DELETED: 'Photo Deleted from Gallery',
  GALLERY_ALBUM_DELETED: 'Gallery Album Deleted',
  CAMPUS_REEL_PUBLISHED: 'New Campus Reel Published',
  CAMPUS_REEL_DELETED: 'Campus Reel Deleted',
  CLUB_SETTINGS_UPDATED: 'Global Club Settings & Links Saved',
  CLUB_TEAM_MEMBER_ADDED: 'New Leadership Profile Added',
  CLUB_TEAM_MEMBER_REMOVED: 'Leadership Profile Removed',
  CLUB_TEAM_MEMBER_UPDATED: 'Leadership Profile Updated',
  SUBSCRIPTION_VERIFIED: 'Student Pass Membership Approved',
  SUBSCRIPTION_REJECTED: 'Student Pass Membership Rejected',
  COMPLAINT_STATUS_UPDATED: 'Helpdesk Doubt Inquiry Status Updated',
  AUDIT_LOGS_PURGED: 'Compliance Audit Logs Purged',
}

const FRIENDLY_PARAM_LABELS = {
  eventTitle: 'Event Name',
  title: 'Event / Item Title',
  name: 'Full Name',
  attendeeName: 'Student Name',
  attendeeMemberId: 'Student Roll No / Member ID',
  verifiedBy: 'Verified By (Admin ID)',
  paymentReference: 'UPI UTR Reference',
  paymentStatus: 'Payment Status',
  paymentAmount: 'Amount (₹)',
  amount: 'Amount (₹)',
  totalAmount: 'Total Amount (₹)',
  requiresPayment: 'Payment Required',
  isTeamEvent: 'Participation Mode',
  isTeam: 'Participation Mode',
  teamName: 'Team Squad Name',
  minTeamSize: 'Minimum Team Size',
  maxTeamSize: 'Maximum Team Size',
  teamRules: 'Team Composition Rules',
  residencyType: 'Residency Type',
  transportMode: 'Commute Mode',
  hostelType: 'Hostel Accommodation',
  gender: 'Gender',
  age: 'Age',
  department: 'Department',
  rollNumber: 'Roll Number',
  phone: 'Phone Number',
  email: 'Email Address',
  role: 'Account Role',
  cscRole: 'Club Role',
  mrduRole: 'MRDU Role',
  reason: 'Reason / Note',
  lockMinutes: 'Lock Duration (Minutes)',
  ticketSubject: 'Doubt Subject',
  ticketCategory: 'Category',
  status: 'Updated Status',
  from: 'Previous Value',
  to: 'New Value',
  filename: 'Exported File Name',
  sizeBytes: 'Backup File Size',
  purgedBy: 'Purged By (Admin)',
  count: 'Total Count',
  ip: 'Network IP Address',
  category: 'Category',
  authorRole: 'Author Role',
  response: 'Response Decision',
}

const TECHNICAL_ID_KEYS = new Set([
  'eventId', 'registrationId', 'albumId', 'photoId', 'reelId', 'complaintId', 'userId', 'actorUserId', 'targetUserId', 'teamId', 'ticketId'
])

function isTechnicalUuid(val) {
  if (typeof val !== 'string') return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val) || /^c[a-z0-9]{24}$/i.test(val)
}

function getFriendlyActionTitle(action) {
  return AUDIT_ACTION_TITLES[action] || action.replaceAll('_', ' ')
}

function formatMetaKey(key) {
  if (FRIENDLY_PARAM_LABELS[key]) return FRIENDLY_PARAM_LABELS[key]
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .replace(/Url$/, ' Link / URL')
    .replace(/Id$/, '')
    .replace(/Upi/, 'UPI')
}

function formatMetaValue(val, key) {
  if (val === null || val === undefined) return 'None'
  if (typeof val === 'boolean') return val ? 'Yes' : 'No'
  if (key === 'sizeBytes' || key === 'size') {
    const num = Number(val)
    if (!isNaN(num)) return `${(num / 1024).toFixed(1)} KB`
  }
  if (key === 'residencyType') {
    return val === 'DAY_SCHOLAR' ? 'Day Scholar' : val === 'HOSTELLER' ? 'Hosteller' : val
  }
  if (key === 'isTeamEvent' || key === 'isTeam') {
    return val ? 'Team Squad' : 'Individual'
  }
  if (key === 'role' || key === 'cscRole' || key === 'mrduRole' || key === 'authorRole') {
    return getRoleLabel(val)
  }
  if (typeof val === 'object') {
    if (Array.isArray(val)) return val.join(', ')
    return JSON.stringify(val, null, 2)
  }
  return String(val).replace(/_/g, ' ')
}

function formatAuditSummary(entry) {
  if (!entry) return 'Action recorded in system audit logs.'
  const meta = entry.metadata || {}
  const targetUser = entry.target?.profile?.name || entry.target?.name || meta.targetName || meta.name || entry.target?.memberId || meta.targetMemberId || meta.memberId

  switch (entry.action) {
    case 'EVENT_ENTRY_GRANTED':
      return `Admitted attendee ${meta.attendeeName || targetUser || 'student'}${meta.attendeeMemberId ? ` (${meta.attendeeMemberId})` : ''} at gate and verified attendance for "${meta.eventTitle || 'Event'}".`
    case 'EVENT_PAYMENT_VERIFIED':
    case 'PASS_PAYMENT_VERIFIED':
      return `Verified ${meta.paymentReference ? `UPI transaction (UTR: ${meta.paymentReference})` : 'payment'} and activated event pass for ${meta.attendeeName || targetUser || 'attendee'}${meta.attendeeMemberId ? ` (${meta.attendeeMemberId})` : ''} for "${meta.eventTitle || 'Event'}".`
    case 'EVENT_CREATED':
      return `Created and published new event "${meta.title || meta.eventTitle || 'Event'}"${meta.requiresPayment ? ` with fee of ₹${meta.paymentAmount || 0}` : ' (Free Event)'}${meta.isTeamEvent ? ' [Team Participation Mode]' : ''}.`
    case 'EVENT_UPDATED':
      return `Updated event schedule, venue, or configuration for "${meta.title || meta.eventTitle || 'Event'}".`
    case 'EVENT_DELETED':
      return `Removed event "${meta.title || meta.eventTitle || 'Event'}" from the university portal.`
    case 'EVENT_REGISTERED':
      return `Submitted registration for event "${meta.eventTitle || 'Event'}"${meta.isTeam ? ` as squad "${meta.teamName}"` : ' as individual'}${meta.paymentReference ? ` (UTR: ${meta.paymentReference})` : ''}.`
    case 'TEAM_INVITE_SENT':
      return `Invited member ${meta.memberId || ''} to join team squad "${meta.teamName || ''}".`
    case 'TEAM_INVITE_RESPONDED':
      return `Responded ${meta.response || ''} to team squad invitation for "${meta.teamName || ''}".`
    case 'ACCOUNT_CREATED':
      return `Provisioned new account for ${meta.name || targetUser || 'member'} (${meta.memberId || 'ID'}, Role: ${getRoleLabel(meta.role || 'STUDENT')}).`
    case 'GUEST_REGISTERED':
      return `Self-registered new guest account for ${meta.name || targetUser || ''} (${meta.memberId || ''}${meta.department ? `, Dept: ${meta.department}` : ''}).`
    case 'BULK_STUDENTS_CREATED':
      return `Bulk provisioned ${meta.count || 0} student accounts with secure credentials.`
    case 'ACCOUNT_STATUS_CHANGED':
      return `Changed account access status of ${targetUser || meta.name || 'member'} from ${meta.from || 'PREV'} to ${meta.to || 'NEW'}.`
    case 'ACCOUNT_AUTO_DISABLED_INACTIVITY':
      return `Account automatically disabled due to inactivity (over 3 days without sign-in) for ${meta.name || targetUser || 'member'} (${meta.memberId || ''}). Reactivation requires Technical Team authorization.`
    case 'ACCOUNT_PERMISSIONS_CHANGED':
      return `Updated administrative permissions for ${targetUser || 'user'}.`
    case 'ACCOUNT_UPDATED':
      return `Updated profile information for ${targetUser || 'user'}.`
    case 'ADMIN_PASSWORD_RESET':
      return `Admin reset the login password for ${meta.targetName || targetUser || 'member'} (${meta.targetMemberId || ''}).`
    case 'TWO_FACTOR_RESET_BY_ADMIN':
      return `Disabled 2FA security lock for ${meta.targetName || targetUser || 'member'} (${meta.targetMemberId || ''}).`
    case 'MEMBER_DELETED':
      return `Permanently removed account for ${meta.targetName || targetUser || 'member'} (${meta.targetMemberId || ''}).`
    case 'MASTER_SECURITY_PIN_CHANGED':
      return `Updated 6-digit Master Security PIN for presidential command authorizations.`
    case 'FULL_DATABASE_EXPORT_SQL':
      return `Generated and exported full database SQL snapshot (${meta.filename || 'backup.sql'}, ${(Number(meta.sizeBytes || 0) / 1024).toFixed(1)} KB).`
    case 'DATABASE_EXPORT_REJECTED_INVALID_PASSWORD':
      return `Blocked database export attempt due to incorrect presidential master password.`
    case 'GALLERY_ALBUM_CREATED':
      return `Created new photo gallery album: "${meta.name || 'Album'}".`
    case 'GALLERY_PHOTO_ADDED':
    case 'GALLERY_PHOTOS_ADDED':
      return `Uploaded ${meta.count ? `${meta.count} photos` : 'photo(s)'} to photo gallery.`
    case 'GALLERY_PHOTO_DELETED':
      return `Deleted photo from photo gallery album.`
    case 'GALLERY_ALBUM_DELETED':
      return `Deleted photo gallery album "${meta.name || 'Album'}" and all its photos.`
    case 'CAMPUS_REEL_PUBLISHED':
      return `Published new short-form campus reel: "${meta.title || 'Reel'}" (${meta.category ? meta.category.replace(/_/g, ' ') : 'Campus'}).`
    case 'CAMPUS_REEL_DELETED':
      return `Deleted campus reel: "${meta.title || 'Reel'}".`
    case 'CLUB_SETTINGS_UPDATED':
      return `Updated global portal settings, links, and contact channels.`
    case 'CLUB_TEAM_MEMBER_ADDED':
      return `Added leadership profile for ${meta.name || 'member'} to the Organizing Team.`
    case 'CLUB_TEAM_MEMBER_REMOVED':
      return `Removed leadership profile for ${meta.name || 'member'} from the Organizing Team.`
    case 'CLUB_TEAM_MEMBER_UPDATED':
      return `Updated leadership profile details for ${meta.name || 'member'}.`
    case 'SUBSCRIPTION_VERIFIED':
      return `Verified UPI payment and activated student membership pass for ${targetUser || meta.targetName || 'student'}${meta.amount ? ` (₹${meta.amount})` : ''}.`
    case 'SUBSCRIPTION_REJECTED':
      return `Rejected membership pass payment for ${targetUser || meta.targetName || 'student'}${meta.reason ? ` (Reason: ${meta.reason})` : ''}.`
    case 'COMPLAINT_STATUS_UPDATED':
      return `Updated status of doubt helpdesk inquiry to "${meta.status || 'UPDATED'}".`
    case 'PRIMARY_PRESIDENT_LOGIN_SUCCESS':
      return 'Primary President logged in with full administrative privileges.'
    case 'PRESIDENT_LOGIN_SUCCESS':
      return 'President logged in successfully.'
    case 'LOGIN_SUCCESS':
      return 'Member logged in successfully.'
    case 'TWO_FACTOR_LOGIN_SUCCESS':
      return 'Two-factor authentication code verified successfully.'
    case 'TWO_FACTOR_LOGIN_FAILED':
      return 'Failed 2FA verification attempt.'
    case 'LOGOUT':
      return 'Logged out of active web session.'
    case 'LOGOUT_ALL_DEVICES':
      return 'Terminated all active user sessions across all devices.'
    case 'LOGIN_BLOCKED':
      return `Sign-in attempt was blocked (${meta.reason === 'ACCOUNT_DISABLED' ? 'Account Disabled' : meta.reason === 'ACCOUNT_LOCKED' ? 'Account Locked' : meta.reason || 'Security Policy'}).`
    case 'ACCOUNT_LOCKED':
      return `Account locked after repeated failed login attempts.`
    case 'PASSWORD_RESET_REQUESTED':
      return 'Password recovery instructions requested.'
    case 'PASSWORD_RESET_COMPLETED':
      return 'Password was successfully reset and updated.'
    case 'TWO_FACTOR_ENABLED':
      return 'Enabled two-factor authentication for account security.'
    case 'TWO_FACTOR_DISABLED':
      return 'Disabled two-factor authentication.'
    case 'AUDIT_LOGS_PURGED':
      return 'Purged security compliance records with Master PIN authorization.'
    default: {
      const parts = []
      if (meta.eventTitle || meta.title) parts.push(`"${meta.eventTitle || meta.title}"`)
      if (meta.attendeeName) parts.push(`Attendee: ${meta.attendeeName}`)
      if (meta.name && meta.name !== targetUser) parts.push(`Name: ${meta.name}`)
      if (meta.paymentReference) parts.push(`UTR: ${meta.paymentReference}`)
      if (meta.status) parts.push(`Status: ${meta.status}`)
      if (parts.length > 0) return `${entry.action.replaceAll('_', ' ')} — ${parts.join(', ')}`
      return entry.action.replaceAll('_', ' ')
    }
  }
}

function AuditLogView({ user, logout, onNavigate }) {
  const { platformMode } = usePlatformTheme()
  const isMrdu = platformMode === 'MRDU_EVENTS'
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLog, setSelectedLog] = useState(null)

  // Clear Audit Modal (Primary President Only)
  const [clearModalOpen, setClearModalOpen] = useState(false)
  const [authCode, setAuthCode] = useState('')
  const [clearing, setClearing] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  function loadLogs() {
    setLoading(true)
    adminApi.listAuditLogs()
      .then(({ auditLogs }) => { setLogs(auditLogs || []) })
      .finally(() => { setLoading(false) })
  }

  useEffect(() => {
    loadLogs()
  }, [])

  async function handleClearAudit(e) {
    e.preventDefault()
    setClearing(true)
    setError('')
    setMessage('')
    try {
      const res = await adminApi.clearAuditLogs(authCode)
      setMessage(res.message)
      setClearModalOpen(false)
      setAuthCode('')
      loadLogs()
    } catch (err) {
      setError(err.message)
    } finally {
      setClearing(false)
    }
  }

  const categories = [
    { id: 'ALL', label: 'All Audits', icon: 'ALL' },
    { id: 'PAYMENTS', label: 'Payments & Subscriptions', icon: 'PAY' },
    { id: 'AUTH', label: 'Authentication & PIN', icon: 'AUTH' },
    { id: 'MEMBERS', label: 'Members & Roles', icon: 'MEMBERS' },
    { id: 'EVENTS', label: 'Events & Passes', icon: 'EVENTS' },
    { id: 'SYSTEM', label: 'System & Support', icon: 'SYS' },
  ]

  const filteredLogs = logs.filter(entry => {
    const cat = getAuditCategory(entry.action)
    if (categoryFilter !== 'ALL' && cat !== categoryFilter) return false

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const actorName = (entry.actor?.profile?.name || entry.actor?.name || entry.metadata?.name || '').toLowerCase()
      const actorId = (entry.actor?.memberId || entry.metadata?.memberId || '').toLowerCase()
      const actorRole = (entry.actor?.role || entry.metadata?.role || '').toLowerCase()
      const targetName = (entry.target?.profile?.name || entry.target?.name || entry.metadata?.targetName || '').toLowerCase()
      const targetId = (entry.target?.memberId || entry.metadata?.targetMemberId || '').toLowerCase()
      const summary = formatAuditSummary(entry).toLowerCase()
      const matchAction = entry.action?.toLowerCase().includes(q)
      const matchMeta = JSON.stringify(entry.metadata || {}).toLowerCase().includes(q)
      if (!matchAction && !actorName.includes(q) && !actorId.includes(q) && !actorRole.includes(q) && !targetName.includes(q) && !targetId.includes(q) && !summary.includes(q) && !matchMeta) return false
    }
    return true
  })

  function handleDownloadAuditLogsCsv() {
    const headers = [
      'Log ID',
      'Date & Time',
      'Member ID',
      'Profile Name',
      'Role',
      'Action / What They Did',
      'Changes / Activity Summary',
      'Target Member ID',
      'Parameters / Details',
    ]
    const rows = filteredLogs.map(l => {
      const actorName = l.actor?.profile?.name || l.actor?.name || l.metadata?.name || (l.actor?.isPrimaryAdmin ? 'Primary President' : l.actorUserId ? 'Authorized Member' : 'System Action')
      const actorId = l.actor?.memberId || l.metadata?.memberId || null
      const actorRole = l.actor?.role || l.metadata?.role || null
      const summary = formatAuditSummary(l)
      return [
        l.id,
        l.createdAt ? new Date(l.createdAt).toLocaleString() : null,
        actorId,
        actorName,
        actorRole,
        l.action,
        summary,
        l.target?.memberId || l.targetUserId || l.targetId,
        l.metadata ? JSON.stringify(l.metadata) : null,
      ]
    })
    downloadCsv('security_audit_logs.csv', headers, rows)
  }

  return (
    <LivePortal user={user} logout={logout} activeTab="admin-audit" onNavigate={onNavigate} title="SECURITY AUDIT LOG">
      <section className="member-management">
        <div className="member-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate('admin-dashboard')}>
              ← COMMAND CENTER
            </button>
            <p className="eyebrow">COMPLIANCE & ACTIVITY TRACEABILITY</p>
            <h1>Security Audit Log</h1>
            <p>Protected immutable logs of member activities, administrative actions, and configuration changes.</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="outline"
              onClick={handleDownloadAuditLogsCsv}
              disabled={filteredLogs.length === 0}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '6px 12px' }}
              title="Download filtered audit logs as CSV"
            >
              <IconDownload size={14} /> DOWNLOAD AUDIT CSV
            </button>
            {user.isPrimaryAdmin && (
              <button
                type="button"
                className="action-btn delete-btn"
                onClick={() => setClearModalOpen(true)}
                style={{ padding: '7px 14px', fontSize: '11px', fontWeight: 'bold' }}
              >
                CLEAR ALL AUDIT LOGS
              </button>
            )}
            <span className="president-lock">PROTECTED RECORDS</span>
          </div>
        </div>

        {message && <p className="member-form-success">{message}</p>}
        {error && <p className="member-form-error">{error}</p>}

        {/* Category Filters */}
        <div className="audit-tabs">
          {categories.map(c => {
            const count = c.id === 'ALL' ? logs.length : logs.filter(l => getAuditCategory(l.action) === c.id).length
            return (
              <button
                key={c.id}
                type="button"
                className={`audit-tab-btn ${categoryFilter === c.id ? 'active' : ''}`}
                onClick={() => setCategoryFilter(c.id)}
              >
                <span>{c.icon}</span>
                <span>{c.label}</span>
                <small style={{ color: categoryFilter === c.id ? 'var(--brand-primary)' : 'var(--text-dim)' }}>({count})</small>
              </button>
            )
          })}
        </div>

        {/* Search Bar */}
        <div style={{ marginBottom: '16px' }}>
          <input
            style={{ width: '100%', height: '38px', padding: '0 14px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text-main)', fontSize: '11px' }}
            placeholder="Search by Member ID, Name, Role, Action, or Changes..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <article className="member-list-card">
          {loading ? (
            <p className="directory-state">Loading audit logs...</p>
          ) : filteredLogs.length === 0 ? (
            <p className="directory-state">No audit log entries match your selected criteria.</p>
          ) : (
            <div className="table-scroll-container">
              <div className="members-table">
                <div className="audit-table-header">
                  <span>MEMBER ID</span>
                  <span>PROFILE NAME</span>
                  <span>ROLE</span>
                  <span>WHAT THEY DID / ACTION</span>
                  <span>DATE & TIMING</span>
                  <span>DETAILS</span>
                </div>
                {filteredLogs.map(entry => {
                  const cat = getAuditCategory(entry.action)
                  const badge = getCategoryBadge(cat, isMrdu)
                  const actorName = entry.actor?.profile?.name || entry.actor?.name || entry.metadata?.name || entry.metadata?.actorName || (entry.actor?.isPrimaryAdmin ? 'Primary President' : entry.actorUserId ? 'Club Member' : 'System Administrator')
                  const actorMemberId = entry.actor?.memberId || entry.metadata?.memberId || entry.metadata?.actorMemberId || (entry.actorUserId ? 'MEMBER' : 'SYSTEM')
                  const actorRole = entry.actor?.role || entry.metadata?.role || entry.metadata?.actorRole || (entry.actorUserId ? 'STUDENT' : 'SYSTEM')
                  const summary = formatAuditSummary(entry)

                  return (
                    <div className="audit-table-row" key={entry.id}>
                      <div>
                        <span style={{ color: 'var(--brand-primary)', fontWeight: 700, fontFamily: 'DM Mono', fontSize: '12px' }}>
                          {actorMemberId}
                        </span>
                      </div>
                      <div>
                        <b style={{ color: 'var(--text-main)', fontSize: '13px', display: 'block' }}>
                          {actorName}
                        </b>
                      </div>
                      <div>
                        <span className="badge" style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.color}44`, fontSize: '10px' }}>
                          {getRoleLabel(actorRole)}
                        </span>
                      </div>
                      <div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <b style={{ color: badge.color, fontSize: '11px', letterSpacing: '0.02em' }}>
                            {getFriendlyActionTitle(entry.action)}
                          </b>
                          <span style={{ color: 'var(--text-muted)', fontSize: '11px', lineHeight: 1.4 }}>
                            {summary}
                          </span>
                        </div>
                      </div>
                      <div>
                        <small style={{ color: 'var(--text-main)', display: 'block', fontSize: '11px' }}>
                          {new Date(entry.createdAt).toLocaleDateString()}
                        </small>
                        <small style={{ color: 'var(--brand-primary)', display: 'block', fontWeight: 600, fontSize: '11px', fontFamily: 'DM Mono' }}>
                          {new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </small>
                      </div>
                      <div>
                        <button
                          type="button"
                          className="action-btn edit-btn"
                          onClick={() => setSelectedLog(entry)}
                          style={{ fontSize: '10px', padding: '4px 8px' }}
                          title="Click to view complete details"
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </article>

        {/* Clear Audit Confirmation Modal */}
        {clearModalOpen && (
          <div className="photo-lightbox" onClick={() => setClearModalOpen(false)}>
            <div className="photo-lightbox-content" onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-modal)', padding: '28px', borderRadius: '14px', border: '1px solid #f8717155', maxWidth: '440px', width: '100%' }}>
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: '8px 0 4px', font: '700 20px Syne', color: '#dc2626' }}>Clear Audit Logs</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: 0 }}>
                  This will purge all previous compliance records from the database. Only the Primary President can execute this.
                </p>
              </div>

              <form onSubmit={handleClearAudit}>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Enter Master Security PIN or Password *
                  <input
                    type="password"
                    required
                    placeholder="Enter PIN or password to authorize"
                    value={authCode}
                    onChange={e => setAuthCode(e.target.value)}
                    style={{ width: '100%', height: '40px', padding: '0 12px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text-main)', marginTop: '4px' }}
                  />
                </label>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
                  <button type="button" className="action-btn cancel-btn" onClick={() => setClearModalOpen(false)}>Cancel</button>
                  <button type="submit" className="primary" disabled={clearing || !authCode} style={{ background: '#dc2626' }}>
                    {clearing ? 'PURGING…' : 'CONFIRM PURGE'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Audit Details Modal */}
        {selectedLog && (() => {
          const actorName = selectedLog.actor?.profile?.name || selectedLog.actor?.name || selectedLog.metadata?.name || (selectedLog.actor?.isPrimaryAdmin ? 'Primary President' : selectedLog.actorUserId ? 'Authorized Member' : 'System Administrator')
          const actorMemberId = selectedLog.actor?.memberId || selectedLog.metadata?.memberId || null
          const actorRole = selectedLog.actor?.role || selectedLog.metadata?.role || null
          const targetName = selectedLog.target?.profile?.name || selectedLog.target?.name || selectedLog.metadata?.targetName || selectedLog.metadata?.attendeeName || null
          const targetMemberId = selectedLog.target?.memberId || selectedLog.metadata?.targetMemberId || selectedLog.metadata?.attendeeMemberId || null
          const targetRole = selectedLog.target?.role || selectedLog.metadata?.targetRole || null
          const summary = formatAuditSummary(selectedLog)
          const friendlyTitle = getFriendlyActionTitle(selectedLog.action)

          // Separate user-facing human parameters from raw internal technical IDs
          const metaEntries = selectedLog.metadata ? Object.entries(selectedLog.metadata) : []
          const humanEntries = metaEntries.filter(([k, v]) => {
            if (TECHNICAL_ID_KEYS.has(k)) return false
            if (isTechnicalUuid(v)) return false
            if (k === 'updatedFields' && Array.isArray(v) && v.length === 0) return false
            return true
          })

          const technicalRefs = metaEntries.filter(([k, v]) => {
            return TECHNICAL_ID_KEYS.has(k) || isTechnicalUuid(v)
          })

          return (
            <div className="photo-lightbox" onClick={() => setSelectedLog(null)}>
              <div className="photo-lightbox-content" onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-modal)', padding: '28px', borderRadius: '14px', border: '1px solid var(--brand-border-subtle)', maxWidth: '640px', width: '100%', maxHeight: '85vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--line)', paddingBottom: '14px', marginBottom: '16px' }}>
                  <div>
                    <span className="badge badge-president" style={{ marginBottom: '6px', fontSize: '10px' }}>
                      {selectedLog.action}
                    </span>
                    <h3 style={{ margin: '4px 0 0', font: '700 18px Syne', color: 'var(--text-main)' }}>
                      {friendlyTitle}
                    </h3>
                  </div>
                  <button className="lightbox-close" onClick={() => setSelectedLog(null)} style={{ position: 'static' }}>✕</button>
                </div>

                {/* Member, Action & Timing Grid */}
                <div className="audit-detail-grid">
                  <div className="audit-detail-field">
                    <b>PERFORMED BY (ADMIN / MEMBER)</b>
                    <p style={{ color: 'var(--text-main)', fontWeight: 600, fontSize: '13px' }}>{actorName}</p>
                    <small style={{ color: 'var(--brand-primary)', fontFamily: 'DM Mono', fontSize: '11px' }}>
                      {actorMemberId ? `${actorMemberId} • ${getRoleLabel(actorRole)}` : 'System Automated Operation'}
                    </small>
                  </div>
                  <div className="audit-detail-field">
                    <b>DATE & EXACT RECORDED TIME</b>
                    <p style={{ color: '#059669', fontFamily: 'DM Mono', fontWeight: 600, fontSize: '12px' }}>
                      {new Date(selectedLog.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' })}
                    </p>
                    <small style={{ color: 'var(--text-dim)', fontSize: '10px' }}>Immutable Security Timestamp</small>
                  </div>

                  {targetMemberId && (
                    <div className="audit-detail-field" style={{ gridColumn: '1 / -1', background: 'var(--panel-subtle)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--line)' }}>
                      <b style={{ color: '#d97706', fontSize: '10px' }}>APPLIED TO TARGET STUDENT / ATTENDEE</b>
                      <p style={{ margin: '4px 0 0', color: 'var(--text-main)', fontSize: '13px', fontWeight: 600 }}>
                        {targetName || targetMemberId} <span style={{ color: 'var(--brand-primary)', fontFamily: 'DM Mono', fontSize: '11px', fontWeight: 'normal' }}>({targetMemberId})</span>
                        {targetRole && <span className="badge" style={{ marginLeft: '8px', fontSize: '9px' }}>{getRoleLabel(targetRole)}</span>}
                      </p>
                    </div>
                  )}

                  <div className="audit-detail-field" style={{ gridColumn: '1 / -1', background: 'var(--panel-subtle)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--brand-border-subtle)' }}>
                    <b style={{ color: 'var(--brand-primary)', fontSize: '10px', letterSpacing: '0.06em' }}>ACTIVITY NARRATIVE & SUMMARY</b>
                    <p style={{ margin: '6px 0 0', color: 'var(--text-main)', fontSize: '13px', lineHeight: 1.6, fontWeight: 500 }}>
                      {summary}
                    </p>
                  </div>
                </div>

                {/* Clear Human-Readable Parameters Breakdown */}
                {humanEntries.length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    <b style={{ color: 'var(--brand-primary)', fontSize: '11px', letterSpacing: '0.04em', display: 'block', marginBottom: '8px' }}>
                      RECORDED EVENT PARAMETERS:
                    </b>
                    <table className="audit-meta-table">
                      <tbody>
                        {humanEntries.map(([k, v]) => (
                          <tr key={k}>
                            <td>{formatMetaKey(k)}</td>
                            <td>{formatMetaValue(v, k)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Technical References (Neat and Unobtrusive) */}
                {technicalRefs.length > 0 && (
                  <div style={{ marginTop: '14px', padding: '8px 12px', background: 'var(--panel-subtle)', borderRadius: '6px', border: '1px solid var(--line)', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                    <small style={{ color: 'var(--text-dim)', fontSize: '10px', fontWeight: 600 }}>System Reference Keys:</small>
                    {technicalRefs.map(([k, v]) => (
                      <span key={k} style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'var(--bg-input)', color: 'var(--brand-primary)', border: '1px solid var(--line)' }}>
                        {formatMetaKey(k)}: #{String(v).slice(0, 8)}
                      </span>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                  <button type="button" className="primary" onClick={() => setSelectedLog(null)} style={{ minHeight: '38px', padding: '0 20px' }}>
                    CLOSE DETAILS
                  </button>
                </div>
              </div>
            </div>
          )
        })()}
      </section>
    </LivePortal>
  )
}

// ----------------------------------------------------
// Executive Council Chat Room (Leads Only)
// ----------------------------------------------------
function CouncilChatView({ user, logout, onNavigate }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [unreadBelow, setUnreadBelow] = useState(0)
  const [showScrollBottom, setShowScrollBottom] = useState(false)

  const chatContainerRef = useRef(null)
  const messagesEndRef = useRef(null)
  const isAtBottomRef = useRef(true)
  const initialScrollDone = useRef(false)

  function scrollToBottom(smooth = true) {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })
      setUnreadBelow(0)
      setShowScrollBottom(false)
      isAtBottomRef.current = true
    }
  }

  function handleScroll() {
    if (!chatContainerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight
    const nearBottom = distanceFromBottom < 80
    isAtBottomRef.current = nearBottom
    setShowScrollBottom(!nearBottom)
    if (nearBottom) {
      setUnreadBelow(0)
    }
  }

  function loadMessages() {
    adminApi.listCouncilMessages()
      .then(res => {
        const incoming = res?.messages || []
        setMessages(prev => {
          if (
            prev.length === incoming.length &&
            prev[prev.length - 1]?.id === incoming[incoming.length - 1]?.id
          ) {
            return prev
          }
          if (prev.length > 0 && incoming.length > prev.length && !isAtBottomRef.current) {
            setUnreadBelow(c => c + (incoming.length - prev.length))
          }
          return incoming
        })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadMessages()
    const interval = setInterval(loadMessages, 3500)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (messages.length === 0) return
    if (!initialScrollDone.current) {
      scrollToBottom(false)
      initialScrollDone.current = true
    } else if (isAtBottomRef.current) {
      scrollToBottom(true)
    }
  }, [messages])

  async function handleSend(e) {
    e.preventDefault()
    if (!text.trim() || sending) return
    setSending(true)
    try {
      const res = await adminApi.sendCouncilMessage(text.trim())
      setMessages(c => [...c, res.message])
      setText('')
      setTimeout(() => scrollToBottom(true), 60)
    } catch (err) {
      alert(err.message)
    } finally {
      setSending(false)
    }
  }

  async function handleDeleteMessage(id) {
    if (!window.confirm('Delete this message from the council room?')) return
    try {
      await adminApi.deleteCouncilMessage(id)
      setMessages(prev => prev.filter(m => m.id !== id))
    } catch (err) {
      alert(err.message || 'Failed to delete message.')
    }
  }

  return (
    <LivePortal user={user} logout={logout} activeTab="admin-chat" onNavigate={onNavigate} title="COUNCIL ROOM">
      <section className="member-management" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
        <div className="member-heading" style={{ marginBottom: '14px' }}>
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate('admin-dashboard')}>
              ← COMMAND CENTER
            </button>
            <p className="eyebrow">RESTRICTED LEADERSHIP CHANNEL</p>
            <h1>Executive Council Room</h1>
            <p>Exclusive internal communications room for club leads, coordinators, and the President.</p>
          </div>
          <span className="president-lock" style={{ background: '#1c182d', color: '#d5baff', borderColor: '#d5baff44' }}>
            LEADS ONLY
          </span>
        </div>

        <article className="account-form-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: '16px', position: 'relative' }}>
          {/* Chat Feed */}
          <div
            ref={chatContainerRef}
            onScroll={handleScroll}
            style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '6px', marginBottom: '14px' }}
          >
            {loading ? (
              <p className="directory-state" style={{ margin: 'auto' }}>Loading council communications...</p>
            ) : messages.length === 0 ? (
              <p className="directory-state" style={{ margin: 'auto' }}>No messages yet. Start the council discussion below!</p>
            ) : (
              messages.map(m => {
                const isMe = m.userId === user.id
                const isPresident = m.user?.isPrimaryAdmin || m.user?.role === 'PRESIDENT'
                const canDelete = isMe || user.isPrimaryAdmin || user.role === 'PRESIDENT'
                return (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      gap: '12px',
                      alignSelf: isMe ? 'flex-end' : 'flex-start',
                      maxWidth: '80%',
                      flexDirection: isMe ? 'row-reverse' : 'row',
                    }}
                  >
                    {m.user?.profile?.profileImage ? (
                      <img src={m.user.profile.profileImage} alt={m.user.name} style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: isPresident ? '2px solid #ffb74d' : '1px solid #52bbf555', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: isPresident ? '#78350f' : '#1c2e42', color: isPresident ? '#ffd54f' : '#85d7ff', display: 'grid', placeItems: 'center', font: '700 11px Syne', flexShrink: 0 }}>
                        {m.user?.profile?.name?.slice(0, 2).toUpperCase() || m.user?.memberId?.slice(0, 2) || 'CS'}
                      </div>
                    )}
                    <div style={{ background: isMe ? 'var(--brand-badge-bg)' : 'var(--panel-elevated)', border: isPresident ? '1px solid #f59e0b' : isMe ? '1px solid var(--brand-border-subtle)' : '1px solid var(--line)', padding: '10px 14px', borderRadius: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <b style={{ color: isPresident ? '#d97706' : 'var(--brand-primary)', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          {isPresident && <IconCrown size={12} />}
                          {m.user?.profile?.name || m.user?.memberId}
                        </b>
                        <span className="badge" style={{ fontSize: '8px', padding: '1px 5px' }}>
                          {isPresident ? 'PRESIDENT' : getRoleLabel(m.user?.role)}
                        </span>
                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <small style={{ color: 'var(--text-dim)', fontSize: '9px' }}>
                            {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </small>
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => handleDeleteMessage(m.id)}
                              title={isMe ? 'Delete your message' : 'Delete message (President Moderation)'}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-dim)',
                                cursor: 'pointer',
                                padding: '2px 4px',
                                borderRadius: '4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                opacity: 0.7,
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.opacity = '1' }}
                              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.opacity = '0.7' }}
                            >
                              <IconTrash size={11} />
                            </button>
                          )}
                        </div>
                      </div>
                      <p style={{ color: 'var(--text-main)', fontSize: '12px', margin: 0, lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                        {m.message}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} style={{ height: 1 }} />
          </div>

          {/* Floating Jump to Latest Button when Scrolled Up */}
          {showScrollBottom && (
            <div style={{ position: 'absolute', bottom: '70px', right: '28px', zIndex: 20 }}>
              <button
                type="button"
                onClick={() => scrollToBottom(true)}
                style={{
                  background: 'var(--brand-primary)',
                  color: '#000',
                  border: 'none',
                  borderRadius: '20px',
                  padding: '7px 16px',
                  fontSize: '11px',
                  fontWeight: 800,
                  boxShadow: '0 6px 20px rgba(0, 229, 255, 0.4), 0 2px 8px rgba(0, 0, 0, 0.6)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'transform 0.15s ease',
                }}
              >
                <span>↓ Jump to Latest</span>
                {unreadBelow > 0 && (
                  <span style={{ background: '#000', color: 'var(--brand-primary)', borderRadius: '10px', padding: '1px 6px', fontSize: '10px' }}>
                    +{unreadBelow}
                  </span>
                )}
              </button>
            </div>
          )}

          {/* Message Input */}
          <form onSubmit={handleSend} style={{ display: 'flex', gap: '10px' }}>
            <input
              placeholder={`Send message to Executive Council as ${user.name} (${getRoleLabel(user.role)})...`}
              value={text}
              onChange={e => setText(e.target.value)}
              style={{ flex: 1, height: '44px', padding: '0 16px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)', fontSize: '12px' }}
            />
            <button className="primary" disabled={sending || !text.trim()} style={{ minHeight: '44px', padding: '0 20px' }}>
              {sending ? 'SENDING…' : 'SEND ➔'}
            </button>
          </form>
        </article>
      </section>
    </LivePortal>
  )
}

// ----------------------------------------------------
// Safe View Boundary to Prevent Any Blank White Screen
// ----------------------------------------------------
class PortalErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, errorInfo) {}
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px 20px', maxWidth: '600px', margin: '60px auto', textAlign: 'center', background: 'var(--panel-subtle)', border: '1px solid var(--line)', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
          <span style={{ fontSize: '36px', display: 'block', marginBottom: '12px' }}>🛡️</span>
          <h3 style={{ color: 'var(--text-main)', margin: '0 0 8px', fontSize: '18px' }}>Portal View Recovered</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '12.5px', margin: '0 0 20px', lineHeight: 1.4 }}>
            {this.state.error?.message || 'A temporary display exception occurred in this portal view.'}
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button type="button" className="primary" onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload() }}>
              ↻ Reload Application
            </button>
            <button type="button" className="outline" onClick={() => { this.setState({ hasError: false, error: null }); if (this.props.onReset) this.props.onReset() }}>
              ← Return to Dashboard
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ----------------------------------------------------
// Root App Controller with Path Preservation & Hibernation
// ----------------------------------------------------
function App() {
  const [user, setUser] = useState(null)
  const resetToken = new URLSearchParams(window.location.search).get('token')
  const [screen, setScreen] = useState(resetToken ? 'reset-password' : 'login')
  const [checkingSession, setCheckingSession] = useState(true)

  // Platform Mode & Theme System
  const [platformMode, setPlatformMode] = useState('CYBER_SECURITY_CLUB')
  const [themeMode, setThemeModeState] = useState(() => {
    return localStorage.getItem('app-theme-preference') || 'system'
  })
  const [systemDark, setSystemDark] = useState(() => {
    return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  // Listen to OS theme changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = e => setSystemDark(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const resolvedTheme = useMemo(() => {
    if (themeMode === 'light') return 'light'
    if (themeMode === 'dark') return 'dark'
    return systemDark ? 'dark' : 'light'
  }, [themeMode, systemDark])

  const setThemeMode = (mode) => {
    setThemeModeState(mode)
    try {
      localStorage.setItem('app-theme-preference', mode)
    } catch {}
  }

  // Synchronize document attributes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme)
  }, [resolvedTheme])

  // Experience & System flags
  const [showIntroVideo, setShowIntroVideo] = useState(false)
  const [showWaitingQueue, setShowWaitingQueue] = useState(false)
  const [isHibernating, setIsHibernating] = useState(false)
  const [adminLoginModal, setAdminLoginModal] = useState(false)

  // Shared Club Settings state with persistent local caching to prevent UI popping/flickering
  const [clubSettings, setClubSettings] = useState(() => {
    try {
      const stored = localStorage.getItem('cached_club_settings')
      if (stored) return JSON.parse(stored)
    } catch (e) {}
    return null
  })

  // Synchronously compute reelsEnabled and subEnabled from cache/network
  const reelsEnabled = clubSettings ? (clubSettings.reelsEnabled !== false && clubSettings.reelsEnabled !== 'false') : true
  const subEnabled = clubSettings ? (clubSettings.subscriptionEnabled === true || clubSettings.subscriptionEnabled === 'true') : false

  const [activePersonaRole, setActivePersonaRole] = useState(null)

  const effectiveUser = useMemo(() => {
    if (!user) return null
    const baseRole = user.originalRole || user.role
    const effectiveRole = activePersonaRole || user.role
    const isEffectiveAdmin = effectiveRole !== 'STUDENT'
    const dynamicPerms = getRolePermissions(effectiveRole)

    const canSwitch = Boolean(
      user.isPrimaryAdmin ||
      user.isAdminUser ||
      baseRole === 'PRESIDENT' ||
      baseRole === 'ADMIN' ||
      baseRole === 'STUDENT_COORDINATOR' ||
      baseRole !== 'STUDENT' ||
      user.isImpersonating
    )

    return {
      ...user,
      role: effectiveRole,
      originalRole: baseRole,
      isAdminUser: isEffectiveAdmin,
      permissions: dynamicPerms,
      canSwitchPersona: canSwitch,
    }
  }, [user, activePersonaRole])

  // Fetch initial public club settings to get current platformMode, reels, subscriptions
  useEffect(() => {
    let mounted = true
    authApi.getPublicSettings()
      .then(({ settings: dict }) => {
        if (!mounted || !dict) return
        if (dict.platformMode) setPlatformMode(dict.platformMode)
        if (dict.siteStatus === 'HIBERNATING') setIsHibernating(true)
        setClubSettings(dict)
        try {
          localStorage.setItem('cached_club_settings', JSON.stringify(dict))
        } catch (e) {}
      })
      .catch(() => {})
    return () => { mounted = false }
  }, [])


  useEffect(() => {
    document.documentElement.setAttribute('data-platform', platformMode)
  }, [platformMode])

  function getScreenFromPath(role) {
    const rawPath = window.location.pathname.replace(/^\//, '').replace(/\/$/, '')
    const path = rawPath.toLowerCase()
    if (path.startsWith('event-detail/')) return rawPath
    if (['events', 'student-events'].includes(path)) return 'student-events'
    if (['passes', 'student-passes', 'my-passes', 'registrations', 'student-registrations'].includes(path)) {
      return role === 'STUDENT' ? 'student-passes' : 'admin-passes'
    }
    if (['reels', 'student-reels'].includes(path)) return 'student-reels'
    if (['membership', 'student-membership'].includes(path)) return 'student-membership'
    if (['support', 'student-support'].includes(path)) return 'student-support'
    if (['team', 'student-team', 'our-team'].includes(path)) return 'student-team'
    if (['gallery', 'student-gallery'].includes(path)) return 'student-gallery'
    if (['profile', 'student-profile'].includes(path)) return role === 'STUDENT' ? 'student-profile' : 'admin-profile'
    if (['security', 'admin/security', 'student/security'].includes(path)) return 'security'
    if (['admin/members', 'admin-members', 'members'].includes(path)) return 'admin-members'
    if (['admin/qr-scanner', 'admin-qr-scanner', 'qr-scanner', 'gate'].includes(path)) return 'admin-qr-scanner'
    if (['admin/events', 'admin-events'].includes(path)) return 'admin-events'
    if (['admin/passes', 'admin-passes', 'admin/payments', 'admin-payments', 'payments'].includes(path)) return 'admin-passes'
    if (['admin/subscriptions', 'admin-subscriptions', 'subscriptions'].includes(path)) return 'admin-subscriptions'
    if (['admin/support', 'admin-support'].includes(path)) return 'admin-support'
    if (['admin/chat', 'admin-chat', 'chat'].includes(path)) return 'admin-chat'
    if (['admin/reels', 'admin-reels'].includes(path)) return 'admin-reels'
    if (['admin/team', 'admin-team'].includes(path)) return 'admin-team'
    if (['admin/gallery', 'admin-gallery'].includes(path)) return 'admin-gallery'
    if (['admin/settings', 'admin-settings', 'settings'].includes(path)) return 'admin-settings'
    if (['admin/audit', 'admin-audit', 'audit'].includes(path)) return 'admin-audit'
    if (['admin/profile', 'admin-profile'].includes(path)) return 'admin-profile'
    return role === 'STUDENT' ? 'student-dashboard' : 'admin-dashboard'
  }

  function navigateTo(nextScreen) {
    setScreen(nextScreen)
    let urlPath = nextScreen
    if (nextScreen.startsWith('event-detail/')) {
      urlPath = `/${nextScreen}`
    } else if (nextScreen === 'student-passes' || nextScreen === 'student-registrations') {
      urlPath = '/passes'
    } else if (nextScreen === 'security') {
      urlPath = '/security'
    } else if (nextScreen.startsWith('admin-')) {
      urlPath = `/${nextScreen.replace('admin-', 'admin/')}`
    } else if (nextScreen.startsWith('student-')) {
      urlPath = `/${nextScreen.replace('student-', '')}`
    } else {
      urlPath = `/${nextScreen}`
    }
    window.history.pushState({}, '', urlPath)
  }

  // Popstate history listener for back/forward browser buttons
  useEffect(() => {
    const handlePop = () => {
      if (effectiveUser) {
        setScreen(getScreenFromPath(effectiveUser.role))
      }
    }
    window.addEventListener('popstate', handlePop)
    return () => window.removeEventListener('popstate', handlePop)
  }, [effectiveUser])

  // Session bootstrap
  useEffect(() => {
    if (resetToken) {
      setCheckingSession(false)
      return undefined
    }
    let mounted = true
    authApi.me()
      .then(async ({ user: authUser }) => {
        if (!mounted) return
        const portalUser = toPortalUser(authUser)
        setUser(portalUser)
        setIsHibernating(false)

        try {
          const status = await memberApi.getSessionStatus()
          if (!status.introVideoCompleted && portalUser.role === 'STUDENT') {
            setShowIntroVideo(true)
          } else if (status.requiresWaitingQueue) {
            setShowWaitingQueue(true)
          }
        } catch {}

        setScreen(getScreenFromPath(portalUser.role))
      })
      .catch(err => {
        if (mounted) {
          if (err.hibernating || err.status === 503) {
            setIsHibernating(true)
          }
          setScreen('login')
        }
      })
      .finally(() => {
        if (mounted) setCheckingSession(false)
      })
    return () => { mounted = false }
  }, [resetToken])

  async function signedIn(memberId, password) {
    const result = await authApi.login(memberId, password)
    if (result.requiresTwoFactor) {
      setScreen('two-factor')
      setAdminLoginModal(false)
      return
    }
    const portalUser = toPortalUser(result.user)
    setUser(portalUser)
    setActivePersonaRole(null)
    setIsHibernating(false)
    setAdminLoginModal(false)

    try {
      const status = await memberApi.getSessionStatus()
      if (!status.introVideoCompleted && portalUser.role === 'STUDENT') {
        setShowIntroVideo(true)
      } else if (status.requiresWaitingQueue) {
        setShowWaitingQueue(true)
      }
    } catch {}

    navigateTo(portalUser.role === 'STUDENT' ? 'student-dashboard' : 'admin-dashboard')
  }

  async function verifyTwoFactor(code) {
    const { user: authUser } = await authApi.verifyTwoFactor(code)
    const portalUser = toPortalUser(authUser)
    setUser(portalUser)
    setActivePersonaRole(null)
    navigateTo(portalUser.role === 'STUDENT' ? 'student-dashboard' : 'admin-dashboard')
  }

  async function logout() {
    try {
      await authApi.logout()
    } finally {
      setUser(null)
      setActivePersonaRole(null)
      setShowIntroVideo(false)
      setShowWaitingQueue(false)
      setScreen('login')
      window.history.pushState({}, '', '/')
    }
  }

  async function handleSwitchAccount(targetId) {
    try {
      const res = await authApi.switchAccount(targetId)
      if (res.user) {
        setUser(toPortalUser(res.user))
        setActivePersonaRole(null)
        const nextRole = res.user.role
        navigateTo(nextRole === 'STUDENT' ? 'student-dashboard' : (nextRole === 'STUDENT_COORDINATOR' ? 'admin-coordinator' : 'admin-dashboard'))
      }
    } catch (err) {
      alert(err.message || 'Failed to switch account.')
    }
  }

  async function handleSwitchBackToAdmin() {
    try {
      const res = await authApi.switchBack()
      if (res.user) {
        setUser(toPortalUser(res.user))
        setActivePersonaRole(null)
        navigateTo('admin-dashboard')
      }
    } catch (err) {
      alert(err.message || 'Failed to switch back to admin account.')
    }
  }

  function renderContent() {
    if (checkingSession) {
      return (
        <main className="auth-loading" style={{ minHeight: '100vh', display: 'grid', placeContent: 'center', gap: 14, background: 'var(--bg-portal)', color: 'var(--brand-primary)', textAlign: 'center' }}>
          <Crest platformMode={platformMode} small />
          <p style={{ font: "500 10px 'DM Mono', monospace", letterSpacing: '.12em', color: 'var(--brand-eyebrow)' }}>VERIFYING SECURE SESSION…</p>
        </main>
      )
    }

    // Hibernation Mode: shown to unauthenticated users and students
    if (isHibernating && (!effectiveUser || effectiveUser.role === 'STUDENT') && !adminLoginModal) {
      return <HibernationScreen onAdminLogin={() => setAdminLoginModal(true)} />
    }

    if (screen === 'reset-password' && resetToken) return <PasswordReset token={resetToken} onComplete={() => setScreen('login')} />
    if (screen === 'password-reset-request') return <PasswordResetRequest onBack={() => setScreen('login')} />
    if (screen === 'two-factor') return <TwoFactorLogin onVerify={verifyTwoFactor} onBack={() => setScreen('login')} />

    if (effectiveUser) {
      let pageContent = null
      if (showIntroVideo) {
        pageContent = <IntroVideoExperience onComplete={() => setShowIntroVideo(false)} />
      } else if (showWaitingQueue) {
        pageContent = <ConcurrentWaitingQueue onComplete={() => setShowWaitingQueue(false)} />
      } else if (screen.startsWith('event-detail/')) {
        const eventId = screen.replace('event-detail/', '')
        pageContent = <StudentEventDetail user={effectiveUser} eventId={eventId} logout={logout} onNavigate={navigateTo} />
      } else if (screen === 'security') {
        pageContent = <AccountSecurity user={effectiveUser} logout={logout} onNavigate={navigateTo} />
      } else if (effectiveUser.isAdminUser) {
        if (screen === 'admin-coordinator' || screen === 'coordinator') pageContent = <CoordinatorConsole user={effectiveUser} logout={logout} onNavigate={navigateTo} />
        else if (screen === 'admin-members' || screen === 'members') pageContent = <MemberManagement user={effectiveUser} logout={logout} onNavigate={navigateTo} />
        else if (screen === 'admin-qr-scanner' || screen === 'qr-scanner') pageContent = <AdminQrScanner user={effectiveUser} logout={logout} onNavigate={navigateTo} />
        else if (screen === 'admin-events' || screen === 'events') pageContent = <EventManagement user={effectiveUser} logout={logout} onNavigate={navigateTo} />
        else if (screen === 'admin-payments' || screen === 'admin-passes' || screen === 'passes') pageContent = <PaymentManagement user={effectiveUser} logout={logout} onNavigate={navigateTo} />
        else if (screen === 'admin-subscriptions' || screen === 'subscriptions') pageContent = <SubscriptionManagement user={effectiveUser} logout={logout} onNavigate={navigateTo} />
        else if (screen === 'admin-support' || screen === 'support') pageContent = <SupportDeskView user={effectiveUser} logout={logout} onNavigate={navigateTo} />
        else if (screen === 'admin-chat' || screen === 'chat') pageContent = <CouncilChatView user={effectiveUser} logout={logout} onNavigate={navigateTo} />
        else if (screen === 'admin-gallery' || screen === 'gallery') pageContent = <GalleryManagement user={effectiveUser} logout={logout} onNavigate={navigateTo} />
        else if (screen === 'admin-reels' || screen === 'reels') pageContent = <ReelsManagement user={effectiveUser} logout={logout} onNavigate={navigateTo} />
        else if (screen === 'admin-team' || screen === 'team') pageContent = <TeamManagement user={effectiveUser} logout={logout} onNavigate={navigateTo} />
        else if (screen === 'admin-settings' || screen === 'settings') pageContent = <ClubSettingsManager user={effectiveUser} logout={logout} onNavigate={navigateTo} />
        else if (screen === 'admin-audit' || screen === 'audit') pageContent = <AuditLogView user={effectiveUser} logout={logout} onNavigate={navigateTo} />
        else if (screen === 'admin-profile') pageContent = <UniversalProfileView user={effectiveUser} logout={logout} onNavigate={navigateTo} onProfileUpdated={u => setUser(toPortalUser(u))} />
        else pageContent = <LivePresidentDashboard user={effectiveUser} logout={logout} onNavigate={navigateTo} onSwitchPersonaRole={setActivePersonaRole} />
      } else {
        if (screen === 'student-events' || screen === 'events') pageContent = <StudentEvents user={effectiveUser} logout={logout} onNavigate={navigateTo} />
        else if (screen === 'student-passes' || screen === 'student-registrations' || screen === 'passes') pageContent = <StudentRegistrations user={effectiveUser} logout={logout} onNavigate={navigateTo} />
        else if (screen === 'student-reels' || screen === 'reels') pageContent = <StudentReels user={effectiveUser} logout={logout} onNavigate={navigateTo} />
        else if (screen === 'student-membership' || screen === 'membership') pageContent = <StudentMembership user={effectiveUser} logout={logout} onNavigate={navigateTo} />
        else if (screen === 'student-support' || screen === 'support') pageContent = <SupportDeskView user={effectiveUser} logout={logout} onNavigate={navigateTo} />
        else if (screen === 'student-team' || screen === 'team') pageContent = <OurTeamShowcase user={effectiveUser} logout={logout} onNavigate={navigateTo} />
        else if (screen === 'student-gallery' || screen === 'gallery') pageContent = <StudentGallery user={effectiveUser} logout={logout} onNavigate={navigateTo} />
        else if (screen === 'student-profile' || screen === 'profile') pageContent = <UniversalProfileView user={effectiveUser} logout={logout} onNavigate={navigateTo} onProfileUpdated={u => setUser(toPortalUser(u))} />
        else pageContent = <LiveStudentDashboard user={effectiveUser} logout={logout} onNavigate={navigateTo} onSwitchPersonaRole={setActivePersonaRole} />
      }

      return (
        <>
          {effectiveUser.isImpersonating && (
            <div style={{
              background: 'linear-gradient(90deg, #78350f, #92400e)',
              color: '#fef3c7',
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid #d97706',
              fontSize: '12px',
              fontWeight: 600,
              position: 'sticky',
              top: 0,
              zIndex: 9999,
              boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '15px' }}>⇄</span>
                <span>SWITCHED ACCOUNT: Viewing as <b>{effectiveUser.name}</b> ({effectiveUser.memberId} · {getRoleLabel(effectiveUser.role)})</span>
                {effectiveUser.originalAdmin && (
                  <span style={{ opacity: 0.85, fontSize: '11px' }}>
                    · Switched from: {effectiveUser.originalAdmin.name} ({effectiveUser.originalAdmin.memberId})
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleSwitchBackToAdmin}
                style={{
                  background: '#f59e0b',
                  color: '#000',
                  border: 'none',
                  borderRadius: '5px',
                  padding: '5px 12px',
                  fontWeight: 800,
                  fontSize: '11px',
                  cursor: 'pointer',
                }}
              >
                ⇄ SWITCH BACK TO ADMIN
              </button>
            </div>
          )}
          {pageContent}
        </>
      )
    }

    return <FinalLogin onSignIn={signedIn} onForgotPassword={() => setScreen('password-reset-request')} />
  }

  return (
    <PlatformThemeContext.Provider value={{
      platformMode,
      setPlatformMode,
      themeMode,
      setThemeMode,
      resolvedTheme,
      clubSettings,
      setClubSettings,
      reelsEnabled,
      subEnabled,
      onSwitchPersonaRole: setActivePersonaRole,
      onSwitchAccount: handleSwitchAccount,
      onSwitchBackToAdmin: handleSwitchBackToAdmin,
    }}>
      <PortalErrorBoundary onReset={() => setScreen(effectiveUser?.isAdminUser ? 'admin-dashboard' : 'student-events')}>
        {renderContent()}
      </PortalErrorBoundary>
    </PlatformThemeContext.Provider>
  )
}

export default App
