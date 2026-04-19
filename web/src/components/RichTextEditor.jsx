import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

const TOOLBAR_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ["bold", "italic", "underline", "strike"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["blockquote", "code-block", "link"],
    ["clean"],
  ],
};

const FORMATS = ["header", "bold", "italic", "underline", "strike", "list", "bullet", "blockquote", "code-block", "link"];

export default function RichTextEditor({ value, onChange, placeholder }) {
  return (
    <div className="rich-editor">
      <ReactQuill theme="snow" value={value || ""} onChange={onChange} modules={TOOLBAR_MODULES} formats={FORMATS} placeholder={placeholder} />
    </div>
  );
}
