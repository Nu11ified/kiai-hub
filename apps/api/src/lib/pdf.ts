import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface RulesPdfConfig {
  eventName: string;
  eventDate: string;
  venueName?: string;
  sections: Array<{ title: string; content: string }>;
  matchRules?: {
    duration: number;
    extensions?: number;
    extensionDuration?: number;
    ipponToWin: number;
    hansokuLimit: number;
    allowsEncho?: boolean;
    enchoHantei?: boolean;
  };
}

export interface BracketEntry {
  matchNumber: number;
  roundNumber: number;
  player1Name: string;
  player2Name: string;
  winnerName?: string;
  courtNumber?: number;
}

export async function generateRulesPdf(
  config: RulesPdfConfig
): Promise<Uint8Array> {
  const { eventName, eventDate, venueName, sections, matchRules } = config;

  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 60;
  const contentWidth = pageWidth - margin * 2;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;
  let pageNumber = 1;

  const addPageNumber = (p: ReturnType<typeof pdfDoc.addPage>, num: number) => {
    const text = `Page ${num}`;
    const textWidth = helvetica.widthOfTextAtSize(text, 10);
    p.drawText(text, {
      x: pageWidth / 2 - textWidth / 2,
      y: margin / 2,
      size: 10,
      font: helvetica,
      color: rgb(0.5, 0.5, 0.5),
    });
  };

  const checkNewPage = (neededHeight: number) => {
    if (y - neededHeight < margin + 20) {
      addPageNumber(page, pageNumber);
      pageNumber++;
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  };

  const drawWrappedText = (
    text: string,
    x: number,
    startY: number,
    maxWidth: number,
    fontSize: number,
    font: typeof helvetica,
    lineHeight: number,
    color = rgb(0, 0, 0)
  ): number => {
    const words = text.split(" ");
    let line = "";
    let currentY = startY;

    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, fontSize);
      if (testWidth > maxWidth && line) {
        checkNewPage(lineHeight);
        page.drawText(line, { x, y: currentY, size: fontSize, font, color });
        currentY -= lineHeight;
        line = word;
      } else {
        line = testLine;
      }
    }
    if (line) {
      checkNewPage(lineHeight);
      page.drawText(line, { x, y: currentY, size: fontSize, font, color });
      currentY -= lineHeight;
    }
    return currentY;
  };

  // Title
  const titleText = eventName;
  const titleFontSize = 24;
  const titleWidth = helveticaBold.widthOfTextAtSize(titleText, titleFontSize);
  page.drawText(titleText, {
    x: pageWidth / 2 - titleWidth / 2,
    y,
    size: titleFontSize,
    font: helveticaBold,
    color: rgb(0, 0, 0),
  });
  y -= 36;

  // Subtitle
  const subtitleText = "Official Rules & Regulations";
  const subtitleFontSize = 14;
  const subtitleWidth = helvetica.widthOfTextAtSize(
    subtitleText,
    subtitleFontSize
  );
  page.drawText(subtitleText, {
    x: pageWidth / 2 - subtitleWidth / 2,
    y,
    size: subtitleFontSize,
    font: helvetica,
    color: rgb(0.3, 0.3, 0.3),
  });
  y -= 24;

  // Divider line
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 1,
    color: rgb(0.7, 0.7, 0.7),
  });
  y -= 18;

  // Event date and venue
  const dateLabel = `Date: ${eventDate}`;
  page.drawText(dateLabel, {
    x: margin,
    y,
    size: 12,
    font: helvetica,
    color: rgb(0, 0, 0),
  });
  y -= 18;

  if (venueName) {
    const venueLabel = `Venue: ${venueName}`;
    page.drawText(venueLabel, {
      x: margin,
      y,
      size: 12,
      font: helvetica,
      color: rgb(0, 0, 0),
    });
    y -= 18;
  }

  y -= 10;

  // Match rules section
  if (matchRules) {
    checkNewPage(30);
    page.drawText("Match Rules", {
      x: margin,
      y,
      size: 14,
      font: helveticaBold,
      color: rgb(0, 0, 0),
    });
    y -= 22;

    const bullets: string[] = [
      `Duration: ${matchRules.duration} minute(s)`,
      `Ippon to Win: ${matchRules.ipponToWin}`,
      `Hansoku Limit: ${matchRules.hansokuLimit}`,
    ];

    if (matchRules.allowsEncho !== undefined) {
      bullets.push(`Encho (Extension Period): ${matchRules.allowsEncho ? "Allowed" : "Not Allowed"}`);
    }

    if (matchRules.allowsEncho && matchRules.extensions !== undefined) {
      bullets.push(`Extensions: ${matchRules.extensions}`);
    }

    if (matchRules.allowsEncho && matchRules.extensionDuration !== undefined) {
      bullets.push(`Extension Duration: ${matchRules.extensionDuration} minute(s)`);
    }

    if (matchRules.enchoHantei !== undefined) {
      bullets.push(`Encho Hantei: ${matchRules.enchoHantei ? "Yes" : "No"}`);
    }

    for (const bullet of bullets) {
      checkNewPage(18);
      page.drawText(`\u2022  ${bullet}`, {
        x: margin + 12,
        y,
        size: 11,
        font: helvetica,
        color: rgb(0, 0, 0),
      });
      y -= 18;
    }

    y -= 10;
  }

  // Custom sections
  for (const section of sections) {
    checkNewPage(40);
    page.drawText(section.title, {
      x: margin,
      y,
      size: 14,
      font: helveticaBold,
      color: rgb(0, 0, 0),
    });
    y -= 22;

    y = drawWrappedText(
      section.content,
      margin,
      y,
      contentWidth,
      11,
      helvetica,
      17
    );

    y -= 12;
  }

  // Add page number to last page
  addPageNumber(page, pageNumber);

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

export async function generateBracketPdf(
  bracketName: string,
  entries: BracketEntry[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Landscape: 792 x 612
  const pageWidth = 792;
  const pageHeight = 612;
  const margin = 40;

  const page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  // Title
  const titleFontSize = 18;
  const titleWidth = helveticaBold.widthOfTextAtSize(bracketName, titleFontSize);
  page.drawText(bracketName, {
    x: pageWidth / 2 - titleWidth / 2,
    y,
    size: titleFontSize,
    font: helveticaBold,
    color: rgb(0, 0, 0),
  });
  y -= 28;

  // Subtitle
  const subtitleText = "Bracket Sheet";
  const subtitleFontSize = 11;
  const subtitleWidth = helvetica.widthOfTextAtSize(subtitleText, subtitleFontSize);
  page.drawText(subtitleText, {
    x: pageWidth / 2 - subtitleWidth / 2,
    y,
    size: subtitleFontSize,
    font: helvetica,
    color: rgb(0.4, 0.4, 0.4),
  });
  y -= 20;

  // Table setup
  const colWidths = [70, 70, 190, 190, 150];
  const colHeaders = ["Match", "Round", "Player 1", "Player 2", "Winner"];
  const colX = [margin];
  for (let i = 0; i < colWidths.length - 1; i++) {
    colX.push(colX[i] + colWidths[i]);
  }

  const rowHeight = 22;
  const fontSize = 10;
  const headerFontSize = 10;

  // Header row background
  page.drawRectangle({
    x: margin,
    y: y - rowHeight,
    width: colWidths.reduce((a, b) => a + b, 0),
    height: rowHeight,
    color: rgb(0.2, 0.2, 0.2),
  });

  // Header text
  for (let i = 0; i < colHeaders.length; i++) {
    page.drawText(colHeaders[i], {
      x: colX[i] + 6,
      y: y - rowHeight + 7,
      size: headerFontSize,
      font: helveticaBold,
      color: rgb(1, 1, 1),
    });
  }
  y -= rowHeight;

  // Data rows
  for (let rowIdx = 0; rowIdx < entries.length; rowIdx++) {
    const entry = entries[rowIdx];
    const bgColor =
      rowIdx % 2 === 0 ? rgb(0.97, 0.97, 0.97) : rgb(1, 1, 1);

    page.drawRectangle({
      x: margin,
      y: y - rowHeight,
      width: colWidths.reduce((a, b) => a + b, 0),
      height: rowHeight,
      color: bgColor,
    });

    const cells = [
      String(entry.matchNumber),
      String(entry.roundNumber),
      entry.player1Name,
      entry.player2Name,
      entry.winnerName ?? "",
    ];

    for (let i = 0; i < cells.length; i++) {
      const isWinnerCol = i === 4;
      const hasWinner = isWinnerCol && entry.winnerName;
      const textColor = hasWinner ? rgb(0, 0.55, 0.1) : rgb(0, 0, 0);
      const font = hasWinner ? helveticaBold : helvetica;

      // Truncate text to fit column
      let text = cells[i];
      const maxW = colWidths[i] - 12;
      while (
        text.length > 0 &&
        font.widthOfTextAtSize(text, fontSize) > maxW
      ) {
        text = text.slice(0, -1);
      }
      if (text !== cells[i]) {
        text = text.slice(0, -1) + "\u2026";
      }

      page.drawText(text, {
        x: colX[i] + 6,
        y: y - rowHeight + 7,
        size: fontSize,
        font,
        color: textColor,
      });
    }

    // Row border
    page.drawLine({
      start: { x: margin, y: y - rowHeight },
      end: { x: margin + colWidths.reduce((a, b) => a + b, 0), y: y - rowHeight },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });

    y -= rowHeight;
  }

  // Outer border
  const tableWidth = colWidths.reduce((a, b) => a + b, 0);
  const tableTop = pageHeight - margin - 28 - 20 - 20;
  const tableHeight = tableTop - y;
  page.drawRectangle({
    x: margin,
    y,
    width: tableWidth,
    height: tableHeight,
    borderColor: rgb(0.5, 0.5, 0.5),
    borderWidth: 1,
  });

  // Column dividers
  for (let i = 1; i < colX.length; i++) {
    page.drawLine({
      start: { x: colX[i], y },
      end: { x: colX[i], y: y + tableHeight },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    });
  }

  // Page number
  const pageNumText = "Page 1";
  const pageNumWidth = helvetica.widthOfTextAtSize(pageNumText, 9);
  page.drawText(pageNumText, {
    x: pageWidth / 2 - pageNumWidth / 2,
    y: margin / 2,
    size: 9,
    font: helvetica,
    color: rgb(0.5, 0.5, 0.5),
  });

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}
