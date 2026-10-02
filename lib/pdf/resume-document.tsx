import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import type { JsonResume } from '../../types/json-resume';

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 36,
    paddingHorizontal: 42,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#1a1a1a',
    lineHeight: 1.4,
  },
  name: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  label: {
    fontSize: 11,
    color: '#333',
    marginBottom: 6,
  },
  contactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 14,
    color: '#444',
    fontSize: 8.5,
  },
  contactItem: {
    marginRight: 6,
  },
  section: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.8,
    marginBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#ccc',
    paddingBottom: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 2,
  },
  rowTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9.5,
    flex: 1,
    paddingRight: 8,
  },
  rowDate: {
    fontSize: 8.5,
    color: '#555',
    textAlign: 'right',
    minWidth: 60,
  },
  subTitle: {
    fontSize: 9,
    color: '#333',
    marginBottom: 2,
  },
  location: {
    fontSize: 8.5,
    color: '#555',
    marginBottom: 4,
  },
  paragraph: {
    fontSize: 9,
    color: '#222',
    marginBottom: 4,
    textAlign: 'justify',
  },
  bullet: {
    flexDirection: 'row',
    marginBottom: 3,
    paddingLeft: 8,
  },
  bulletDot: {
    width: 10,
    fontSize: 9,
  },
  bulletText: {
    flex: 1,
    fontSize: 9,
    color: '#222',
  },
  skillLine: {
    fontSize: 9,
    marginBottom: 3,
  },
  skillLabel: {
    fontFamily: 'Helvetica-Bold',
  },
  certRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  certName: {
    flex: 1,
    fontSize: 9,
  },
});

function formatLocation(basics: JsonResume['basics']): string | null {
  const parts = [
    basics.location?.city,
    basics.location?.region,
    basics.location?.countryCode,
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

function formatDateRange(start?: string, end?: string): string {
  if (start && end) return `${start} — ${end}`;
  return end ?? start ?? '';
}

function formatEducationLine(edu: NonNullable<JsonResume['education']>[number]): string {
  const degree = [edu.studyType, edu.area].filter(Boolean).join(' in ');
  const gpa = edu.score ? ` (GPA: ${edu.score})` : '';
  return `${degree || edu.area || 'Degree'}${gpa}`;
}

function ContactRow({ resume }: { resume: JsonResume }) {
  const { basics } = resume;
  const textParts: string[] = [];

  if (basics.phone) textParts.push(basics.phone);
  if (basics.email) textParts.push(basics.email);

  const loc = formatLocation(basics);
  if (loc) textParts.push(loc);

  for (const profile of basics.profiles ?? []) {
    textParts.push(profile.network || profile.username || 'Profile');
  }

  if (textParts.length === 0) return null;

  return <Text style={styles.contactRow}>{textParts.join(' ◇ ')}</Text>;
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function Bullets({ items }: { items: string[] }) {
  return (
    <>
      {items.map((item, i) => (
        <View key={i} style={styles.bullet} wrap={false}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </>
  );
}

export function ResumeDocument({ resume }: { resume: JsonResume }) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.name}>{resume.basics.name}</Text>
        {resume.basics.label && (
          <Text style={styles.label}>{resume.basics.label}</Text>
        )}
        <ContactRow resume={resume} />

        {resume.basics.summary && (
          <View style={styles.section}>
            <SectionTitle title="SUMMARY" />
            <Text style={styles.paragraph}>{resume.basics.summary}</Text>
          </View>
        )}

        {(resume.work?.length ?? 0) > 0 && (
          <View style={styles.section}>
            <SectionTitle title="EXPERIENCE" />
            {resume.work!.map((job, i) => (
              <View key={i} style={{ marginBottom: 8 }} wrap={false}>
                <View style={styles.row}>
                  <Text style={styles.rowTitle}>{job.name}</Text>
                  <Text style={styles.rowDate}>
                    {formatDateRange(job.startDate, job.endDate)}
                  </Text>
                </View>
                {job.position && (
                  <Text style={styles.subTitle}>{job.position}</Text>
                )}
                {job.location && (
                  <Text style={styles.location}>{job.location}</Text>
                )}
                {job.summary && (
                  <Text style={styles.paragraph}>{job.summary}</Text>
                )}
                {job.highlights && job.highlights.length > 0 && (
                  <Bullets items={job.highlights} />
                )}
              </View>
            ))}
          </View>
        )}

        {(resume.education?.length ?? 0) > 0 && (
          <View style={styles.section}>
            <SectionTitle title="EDUCATION" />
            {resume.education!.map((edu, i) => (
              <View key={i} style={{ marginBottom: 6 }}>
                <View style={styles.row}>
                  <Text style={styles.rowTitle}>
                    {formatEducationLine(edu)}
                    {edu.institution ? `, ${edu.institution}` : ''}
                  </Text>
                  <Text style={styles.rowDate}>
                    {formatDateRange(edu.startDate, edu.endDate)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {(resume.certificates?.length ?? 0) > 0 && (
          <View style={styles.section}>
            <SectionTitle title="CERTIFICATIONS" />
            {resume.certificates!.map((cert, i) => (
              <View key={i} style={styles.certRow}>
                <Text style={styles.certName}>
                  {cert.name}
                  {cert.issuer ? `, ${cert.issuer}` : ''}
                </Text>
                {cert.date && <Text style={styles.rowDate}>{cert.date}</Text>}
              </View>
            ))}
          </View>
        )}

        {(resume.projects?.length ?? 0) > 0 && (
          <View style={styles.section}>
            <SectionTitle title="PROJECTS" />
            {resume.projects!.map((project, i) => (
              <View key={i} style={{ marginBottom: 6 }}>
                <Text style={styles.subTitle}>{project.name}</Text>
                {project.description && (
                  <Text style={styles.paragraph}>{project.description}</Text>
                )}
                {project.highlights && project.highlights.length > 0 && (
                  <Bullets items={project.highlights} />
                )}
              </View>
            ))}
          </View>
        )}

        {(resume.skills?.length ?? 0) > 0 && (
          <View style={styles.section}>
            <SectionTitle title="SKILLS" />
            {resume.skills!.map((skill, i) => (
              <Text key={i} style={styles.skillLine}>
                <Text style={styles.skillLabel}>{skill.name}: </Text>
                {skill.keywords.join(', ')}
              </Text>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
}
