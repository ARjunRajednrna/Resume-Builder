import { writeFileSync } from 'fs';
import { renderResumePdf, validatePdfStructure } from '../lib/pdf/render-resume-pdf';
import type { JsonResume } from '../types/json-resume';

const sample: JsonResume = {
  basics: {
    name: 'Arjun Rajendran',
    label: 'Software Developer',
    email: 'arjunrajendran62@gmail.com',
    phone: '+918828378300',
    location: { city: 'Mumbai', region: 'Maharashtra', countryCode: 'India' },
    profiles: [{ network: 'LinkedIn' }, { network: 'GitHub' }],
  },
  work: [
    {
      name: 'Arka Infotech Software Solutions',
      position: 'Software Developer',
      location: 'Ghatkopar, Mumbai',
      startDate: "Nov '25",
      endDate: 'Present',
      summary:
        'Full-stack developer with hands-on experience building production-grade web applications.',
    },
  ],
  education: [
    {
      institution: 'Thakur College of Science and Commerce',
      studyType: 'Master',
      area: 'Information Technology',
      endDate: 'Present',
    },
  ],
  certificates: [
    {
      name: 'Introduction to Model Context Protocol',
      issuer: 'Anthropic Education',
      date: "May '26",
    },
  ],
  projects: [
    {
      name: 'Deepfake Detection Using Deep Learning',
      highlights: ['Built detection system achieving 93.58% accuracy'],
    },
  ],
  skills: [
    { name: 'Languages', keywords: ['Python', 'JavaScript'] },
    { name: 'Tools', keywords: ['Cursor', 'GitHub'] },
  ],
};

async function main() {
  const buf = await renderResumePdf(sample);
  writeFileSync('test-template-output.pdf', buf);
  const ok = await validatePdfStructure(buf, 'Arjun Rajendran');
  console.log('PDF bytes:', buf.length, 'Structure OK:', ok);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
