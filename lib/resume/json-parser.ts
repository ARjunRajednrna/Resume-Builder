// lib/resume/json-parser.ts
import { ResumeData } from '../../types/resume';

export function parseTailoredResumeToJSON(tailoredResumeText: string): ResumeData {
  const resumeData: ResumeData = {
    personal: { name: '', email: '' },
    summary: '',
    skills: { programmingLanguages: [], frameworksTools: [], practicesMethods: [] },
    experience: [],
    education: [],
    projects: [],
    certifications: [],
    languages: [],
  };

  const lines = tailoredResumeText.split('\n');
  let currentSection = '';
  let currentJob: any = null;
  let currentEdu: any = null;
  let isCollectingSummary = false;
  let summaryLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line) continue;

    // Detect sections (case insensitive)
    const upperLine = line.toUpperCase();
    
    if (upperLine.includes('CONTACT') || upperLine.includes('PERSONAL') || (upperLine.includes('NAME') && i < 5)) {
      currentSection = 'personal';
      isCollectingSummary = false;
      continue;
    }
    
    if (upperLine.includes('SUMMARY') || upperLine.includes('PROFILE') || upperLine.includes('ABOUT')) {
      currentSection = 'summary';
      isCollectingSummary = true;
      summaryLines = [];
      continue;
    }
    
    if (upperLine.includes('SKILLS') || upperLine.includes('TECHNICAL SKILLS') || upperLine.includes('CORE COMPETENCIES')) {
      currentSection = 'skills';
      isCollectingSummary = false;
      continue;
    }
    
    if (upperLine.includes('EXPERIENCE') || upperLine.includes('WORK HISTORY') || upperLine.includes('EMPLOYMENT')) {
      currentSection = 'experience';
      isCollectingSummary = false;
      continue;
    }
    
    if (upperLine.includes('EDUCATION') || upperLine.includes('ACADEMIC')) {
      currentSection = 'education';
      isCollectingSummary = false;
      continue;
    }
    
    if (upperLine.includes('PROJECTS')) {
      currentSection = 'projects';
      isCollectingSummary = false;
      continue;
    }
    
    if (upperLine.includes('CERTIFICATIONS')) {
      currentSection = 'certifications';
      isCollectingSummary = false;
      continue;
    }

    // Parse based on section
    switch (currentSection) {
      case 'personal':
        if (line.includes('@') && !resumeData.personal.email) {
          resumeData.personal.email = line;
        } else if (line.match(/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/) && !resumeData.personal.phone) {
          resumeData.personal.phone = line;
        } else if (line.length > 0 && line.length < 50 && !resumeData.personal.name && !line.includes('@') && !line.match(/\d/)) {
          resumeData.personal.name = line;
        } else if (line.includes('linkedin.com') && !resumeData.personal.linkedin) {
          resumeData.personal.linkedin = line;
        } else if (line.includes('github.com') && !resumeData.personal.github) {
          resumeData.personal.github = line;
        } else if (!resumeData.personal.location && line.match(/[A-Za-z]+,?\s*[A-Z]{2}/)) {
          resumeData.personal.location = line;
        }
        break;
        
      case 'summary':
        if (isCollectingSummary && !line.match(/^(SKILLS|EXPERIENCE|EDUCATION)/i)) {
          summaryLines.push(line);
          resumeData.summary = summaryLines.join(' ');
        }
        break;
        
      case 'skills':
        if (line.includes(':')) {
          const [category, items] = line.split(':');
          const skillsList = items.split(',').map(s => s.trim()).filter(s => s);
          const catLower = category.toLowerCase();
          
          if (catLower.includes('programming') || catLower.includes('language')) {
            resumeData.skills.programmingLanguages = skillsList;
          } else if (catLower.includes('framework') || catLower.includes('tool')) {
            resumeData.skills.frameworksTools = skillsList;
          } else if (catLower.includes('practice') || catLower.includes('method')) {
            resumeData.skills.practicesMethods = skillsList;
          }
        } else if (line.startsWith('•') || line.startsWith('-')) {
          // Handle bullet list skills
          const skill = line.replace(/^[•\-]\s*/, '');
          if (skill.match(/react|node|python|javascript|typescript|java|go|rust|aws|docker|kubernetes/i)) {
            resumeData.skills.frameworksTools.push(skill);
          } else if (skill.match(/agile|scrum|ci\/cd|devops|tdd|git/i)) {
            resumeData.skills.practicesMethods.push(skill);
          } else {
            resumeData.skills.programmingLanguages.push(skill);
          }
        }
        break;
        
      case 'experience':
        // Check if line looks like a company title (has dates or company format)
        if (line.match(/^[A-Z][a-z]+.*(?:-|–|—|\d{4})/) || (line.includes('Inc') || line.includes('LLC') || line.includes('Corp'))) {
          if (currentJob) {
            resumeData.experience.push(currentJob);
          }
          // Parse company and dates
          const dateMatch = line.match(/(\d{4}\s*[-–—]\s*(?:\d{4}|Present|Current))/i);
          const companyPart = dateMatch ? line.substring(0, dateMatch.index) : line;
          const dates = dateMatch ? dateMatch[0] : '';
          
          currentJob = {
            company: companyPart.replace(/\s+$/, ''),
            title: '',
            dates: dates,
            achievements: [],
          };
        } else if (currentJob && !currentJob.title && line.length > 0 && line.length < 100 && !line.startsWith('•') && !line.startsWith('-')) {
          currentJob.title = line;
        } else if ((line.startsWith('•') || line.startsWith('-') || line.match(/^\d+\./)) && currentJob) {
          currentJob.achievements.push(line.replace(/^[•\-\d\.]\s*/, ''));
        }
        break;
        
      case 'education':
        if (line.match(/Bachelor|Master|PhD|B\.|M\.|Associate|Diploma/i) || line.includes('University') || line.includes('College')) {
          if (currentEdu) {
            resumeData.education.push(currentEdu);
          }
          const dateMatch = line.match(/(\d{4}\s*[-–—]\s*(?:\d{4}|Present))/i);
          const eduPart = dateMatch ? line.substring(0, dateMatch.index) : line;
          currentEdu = {
            degree: eduPart,
            institution: '',
            dates: dateMatch ? dateMatch[0] : '',
          };
        } else if (currentEdu && !currentEdu.institution && line.length > 0 && line.length < 100) {
          currentEdu.institution = line;
        } else if (currentEdu && line.length > 0 && !line.match(/Bachelor|Master|PhD/i)) {
          currentEdu.details = line;
        }
        break;
    }
  }
  
  // Push last entries
  if (currentJob) resumeData.experience.push(currentJob);
  if (currentEdu) resumeData.education.push(currentEdu);
  
  // Clean up and set defaults if empty
  if (!resumeData.personal.name && tailoredResumeText.length > 0) {
    const firstLines = tailoredResumeText.split('\n').slice(0, 3);
    for (const line of firstLines) {
      if (line.trim().length > 0 && line.trim().length < 50 && !line.includes('@')) {
        resumeData.personal.name = line.trim();
        break;
      }
    }
  }
  
  if (!resumeData.personal.email && tailoredResumeText.includes('@')) {
    const emailMatch = tailoredResumeText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) resumeData.personal.email = emailMatch[0];
  }
  
  if (resumeData.experience.length === 0) {
    resumeData.experience.push({
      company: 'Work Experience',
      title: '',
      dates: '',
      achievements: ['Add your experience here'],
    });
  }
  
  if (resumeData.education.length === 0) {
    resumeData.education.push({
      degree: 'Education',
      institution: '',
      dates: '',
    });
  }
  
  return resumeData;
}