'use client';
import { useState } from 'react';
import { Upload, FileText, Sparkles, Download } from 'lucide-react';

export default function Home() {
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resumeFile || !jobDescription) return;

    setLoading(true);
    setError('');
    setSuccess(false);

    const formData = new FormData();
    formData.append('resume', resumeFile);
    formData.append('jobDescription', jobDescription);

    try {
      const response = await fetch('/api/tailor-resume', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to tailor resume');
      }

      // Get PDF blob and download
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `tailored-resume-${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setSuccess(true);
      
      // Reset success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 py-12">
      <div className="max-w-4xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <div className="bg-blue-600 text-white p-3 rounded-2xl">
              <Sparkles className="w-8 h-8" />
            </div>
          </div>
          <h1 className="text-5xl font-bold text-gray-900 mb-3">
            AI Resume Tailor
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Upload your resume and let AI optimize it for your target job description
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-10 border border-gray-100">
          <form onSubmit={handleSubmit} className="space-y-10">
            {/* Resume Upload */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Upload Your Resume (PDF)
              </label>
              <div className="border-2 border-dashed border-gray-300 hover:border-blue-500 transition-colors rounded-2xl p-10 text-center bg-gray-50">
                <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-lg font-medium text-gray-700">
                  {resumeFile ? resumeFile.name : "Drag & drop your resume here"}
                </p>
                <p className="text-sm text-gray-500 mt-1">or click to browse (PDF only, max 5MB)</p>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="resume-upload"
                />
                <label
                  htmlFor="resume-upload"
                  className="mt-4 inline-block px-6 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-medium cursor-pointer hover:bg-gray-50 transition"
                >
                  Choose File
                </label>
              </div>
            </div>

            {/* Job Description */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Job Description
              </label>
              <textarea
                placeholder="Paste the job description here (minimum 50 characters)..."
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                rows={10}
                className="w-full px-5 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-y min-h-[180px] text-gray-700"
              />
              <p className="mt-2 text-sm text-gray-500">
                {jobDescription.length} characters
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !resumeFile || !jobDescription || jobDescription.length < 50}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 rounded-2xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent animate-spin rounded-full" />
                  Analyzing & Tailoring Your Resume (30-60s)...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate & Download Tailored Resume
                </>
              )}
            </button>
          </form>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
          
          {success && (
            <div className="mt-4 p-4 bg-green-50 border border-green-100 rounded-xl">
              <p className="text-sm text-green-700 flex items-center gap-2">
                <Download className="w-4 h-4" />
                PDF downloaded successfully! Check your Downloads folder.
              </p>
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Your resume is extracted, tailored for the job, and rendered into a clean ATS-friendly template.</p>
          <p className="mt-1">Name, contact info, dates, education, and certifications are preserved — only wording is optimized.</p>
        </div>
      </div>
    </main>
  );
}