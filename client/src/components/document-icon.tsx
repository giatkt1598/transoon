import { Box } from "@mui/material";
import csvFileIcon from "../assets/icons/csv-file.png";
import documentationIcon from "../assets/icons/documentation.png";
import excelIcon from "../assets/icons/excel.png";
import notepadIcon from "../assets/icons/notepad.png";
import powerpointIcon from "../assets/icons/powerpoint.png";
import wordIcon from "../assets/icons/word.png";

type DocumentIconProps = {
  fileName: string | null | undefined;
  size?: number;
};

function getFileExtension(fileName: string | null | undefined) {
  if (!fileName) {
    return "";
  }

  const match = /\.([a-z0-9]+)$/i.exec(fileName.trim());
  return match?.[1]?.toLowerCase() ?? "";
}

function getDocumentIconSource(extension: string) {
  switch (extension) {
    case "doc":
    case "docx":
      return wordIcon;
    case "xls":
    case "xlsx":
      return excelIcon;
    case "ppt":
    case "pptx":
      return powerpointIcon;
    case "csv":
      return csvFileIcon;
    case "txt":
      return notepadIcon;
    default:
      return documentationIcon;
  }
}

export function DocumentIcon({
  fileName,
  size = 28,
}: DocumentIconProps) {
  const extension = getFileExtension(fileName);
  const iconSource = getDocumentIconSource(extension);

  return (
    <Box
      component="img"
      src={iconSource}
      alt=""
      aria-hidden="true"
      className="document-icon-image"
      sx={{ width: size, height: size }}
      title={fileName ?? "Document"}
    />
  );
}
