export interface JsonResumeBasics {
  name: string;
  label?: string;
  email: string;
  phone?: string;
  url?: string;
  summary?: string;
  location?: {
    city?: string;
    region?: string;
    countryCode?: string;
  };
  profiles?: Array<{
    network: string;
    url?: string;
    username?: string;
  }>;
}

export interface JsonResumeWork {
  name: string;
  position?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  summary?: string;
  highlights?: string[];
}

export interface JsonResumeEducation {
  institution: string;
  area?: string;
  studyType?: string;
  startDate?: string;
  endDate?: string;
  score?: string;
}

export interface JsonResumeSkill {
  name: string;
  keywords: string[];
}

export interface JsonResumeProject {
  name: string;
  description?: string;
  highlights?: string[];
}

export interface JsonResumeCertificate {
  name: string;
  issuer?: string;
  date?: string;
}

export interface JsonResume {
  basics: JsonResumeBasics;
  work?: JsonResumeWork[];
  education?: JsonResumeEducation[];
  skills?: JsonResumeSkill[];
  projects?: JsonResumeProject[];
  certificates?: JsonResumeCertificate[];
}
