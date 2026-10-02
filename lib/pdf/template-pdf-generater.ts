// lib/pdf/template-pdf-generator.ts
import { PDFDocument, StandardFonts, rgb, PageSizes } from 'pdf-lib';
import { ResumeData } from '../../types/resume';

export async function generateResumePDF(resumeData: ResumeData): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage(PageSizes.Letter);
  const { width, height } = page.getSize();
  
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  let y = height - 50;
  let currentPage = page;
  
  function checkNewPage(neededLines: number = 1) {
    if (y < 80) {
      currentPage = pdfDoc.addPage(PageSizes.Letter);
      y = height - 50;
    }
  }
  
  function drawTextWithWrap(text: string, x: number, yPos: number, size: number, font: any, color: any, maxWidth: number = width - 100) {
    const words = text.split(' ');
    let line = '';
    let currentY = yPos;
    
    for (const word of words) {
      const testLine = line + (line ? ' ' : '') + word;
      const testWidth = font.widthOfTextAtSize(testLine, size);
      
      if (testWidth > maxWidth && line) {
        currentPage.drawText(line, { x, y: currentY, size, font, color });
        currentY -= size + 2;
        line = word;
        checkNewPage();
      } else {
        line = testLine;
      }
    }
    if (line) {
      currentPage.drawText(line, { x, y: currentY, size, font, color });
      currentY -= size + 2;
    }
    return currentY;
  }
  
  // ─── NAME ──────────────────────────────────────────
  currentPage.drawText(resumeData.personal.name.toUpperCase(), {
    x: 50, y, size: 26, font: helveticaBold, color: rgb(0.1, 0.1, 0.1),
  });
  y -= 35;
  
  // ─── Contact Info ──────────────────────────────────
  const contactParts = [
    resumeData.personal.email,
    resumeData.personal.phone,
    resumeData.personal.location,
    resumeData.personal.linkedin?.replace('https://', ''),
    resumeData.personal.github?.replace('https://', ''),
  ].filter(Boolean);
  
  if (contactParts.length) {
    currentPage.drawText(contactParts.join('  |  '), {
      x: 50, y, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4),
    });
    y -= 25;
  }
  
  // ─── Divider ───────────────────────────────────────
  currentPage.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 1, color: rgb(0.85, 0.85, 0.85) });
  y -= 20;
  
  // ─── SUMMARY ───────────────────────────────────────
  if (resumeData.summary) {
    currentPage.drawText('PROFESSIONAL SUMMARY', {
      x: 50, y, size: 11, font: helveticaBold, color: rgb(0.1, 0.1, 0.1),
    });
    y -= 18;
    y = drawTextWithWrap(resumeData.summary, 50, y, 9, helvetica, rgb(0.2, 0.2, 0.2), width - 100);
    y -= 15;
  }
  
  // ─── SKILLS ───────────────────────────────────────
  currentPage.drawText('TECHNICAL SKILLS', {
    x: 50, y, size: 11, font: helveticaBold, color: rgb(0.1, 0.1, 0.1),
  });
  y -= 18;
  
  if (resumeData.skills.programmingLanguages.length) {
    currentPage.drawText(`Languages: ${resumeData.skills.programmingLanguages.join(', ')}`, {
      x: 55, y, size: 9, font: helvetica, color: rgb(0.2, 0.2, 0.2),
    });
    y -= 14;
  }
  
  if (resumeData.skills.frameworksTools.length) {
    currentPage.drawText(`Frameworks & Tools: ${resumeData.skills.frameworksTools.join(', ')}`, {
      x: 55, y, size: 9, font: helvetica, color: rgb(0.2, 0.2, 0.2),
    });
    y -= 14;
  }
  
  if (resumeData.skills.practicesMethods.length) {
    currentPage.drawText(`Methodologies: ${resumeData.skills.practicesMethods.join(', ')}`, {
      x: 55, y, size: 9, font: helvetica, color: rgb(0.2, 0.2, 0.2),
    });
    y -= 14;
  }
  y -= 10;
  
  // ─── EXPERIENCE ────────────────────────────────────
  currentPage.drawText('WORK EXPERIENCE', {
    x: 50, y, size: 11, font: helveticaBold, color: rgb(0.1, 0.1, 0.1),
  });
  y -= 22;
  
  for (const job of resumeData.experience) {
    checkNewPage(3);
    
    // Company and dates
    currentPage.drawText(job.company, {
      x: 50, y, size: 10, font: helveticaBold, color: rgb(0.1, 0.1, 0.1),
    });
    
    if (job.dates) {
      const dateWidth = helvetica.widthOfTextAtSize(job.dates, 9);
      currentPage.drawText(job.dates, {
        x: width - 50 - dateWidth, y, size: 9, font: helvetica, color: rgb(0.5, 0.5, 0.5),
      });
    }
    y -= 14;
    
    // Job title
    if (job.title) {
      currentPage.drawText(job.title, {
        x: 55, y, size: 9, font: helvetica, color: rgb(0.3, 0.3, 0.3),
      });
      y -= 14;
    }
    
    // Achievements
    const bullets = (job.details ?? []).slice(0, 6);
    for (const achievement of bullets) {
      const bulletLines = wrapText(`• ${achievement}`, 85);
      for (const line of bulletLines) {
        checkNewPage();
        currentPage.drawText(line, {
          x: 65, y, size: 8.5, font: helvetica, color: rgb(0.2, 0.2, 0.2),
        });
        y -= 12;
      }
    }
    y -= 5;
  }
  
  // ─── EDUCATION ─────────────────────────────────────
  if (resumeData.education.length) {
    checkNewPage(2);
    currentPage.drawText('EDUCATION', {
      x: 50, y, size: 11, font: helveticaBold, color: rgb(0.1, 0.1, 0.1),
    });
    y -= 22;
    
    for (const edu of resumeData.education) {
      checkNewPage(2);
      currentPage.drawText(edu.degree, {
        x: 50, y, size: 10, font: helveticaBold, color: rgb(0.1, 0.1, 0.1),
      });
      
      if (edu.dates) {
        const dateWidth = helvetica.widthOfTextAtSize(edu.dates, 9);
        currentPage.drawText(edu.dates, {
          x: width - 50 - dateWidth, y, size: 9, font: helvetica, color: rgb(0.5, 0.5, 0.5),
        });
      }
      y -= 14;
      
      if (edu.institution) {
        currentPage.drawText(edu.institution, {
          x: 55, y, size: 9, font: helvetica, color: rgb(0.3, 0.3, 0.3),
        });
        y -= 14;
      }
      
      if (edu.details) {
        y = drawTextWithWrap(edu.details, 65, y, 8.5, helvetica, rgb(0.2, 0.2, 0.2), width - 130);
      }
      y -= 8;
    }
  }
  
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    if ((currentLine + ' ' + word).length <= maxCharsPerLine) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}