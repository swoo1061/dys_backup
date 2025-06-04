// components/FileUpload.js - 파일 업로드 컴포넌트
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';

export default function FileUpload({ onUploadComplete }) {
  const [uploadHistory, setUploadHistory] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      // FormData 생성
      const formData = new FormData();
      formData.append('file', file);
      
      setUploadProgress(50); // 업로드 중
      
      // 파일 업로드
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      
      if (result.success) {
        setUploadProgress(100); // 완료
        
        // 업로드 이력 추가
        const newHistory = {
          id: Date.now(),
          uploadDate: new Date().toLocaleString(),
          fileName: file.name,
          projectName: result.project.projectName,
          uploader: '김과장',
          size: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
          status: '✅',
          note: ''
        };
        
        setUploadHistory([newHistory, ...uploadHistory]);
        
        // 1초 후 완료 메시지
        setTimeout(() => {
          alert('업로드 완료!');
          onUploadComplete(); // 프로젝트 목록 새로고침
          setUploadProgress(0);
        }, 1000);
      }
      
    } catch (error) {
      console.error('Upload error:', error);
      const errorHistory = {
        id: Date.now(),
        uploadDate: new Date().toLocaleString(),
        fileName: file.name,
        projectName: '-',
        uploader: '김과장',
        size: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
        status: '❌',
        note: '형식 오류'
      };
      setUploadHistory([errorHistory, ...uploadHistory]);
      alert('업로드 실패!');
    } finally {
      setUploading(false);
    }
  }, [uploadHistory, onUploadComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    maxFiles: 1
  });

  return (
    <div className="space-y-6">
      {/* 업로드 영역 */}
      <div className="bg-white rounded-lg shadow p-8">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
            isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <input {...getInputProps()} />
          <div className="text-gray-600">
            <div className="text-4xl mb-4">📁</div>
            <p className="text-lg mb-2">Excel 파일을 드래그하세요</p>
            <p className="text-sm text-gray-500">또는</p>
            <button className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
              파일 선택하기
            </button>
          </div>
        </div>

        {/* 업로드 진행률 */}
        {uploading && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">파일 검증 중...</span>
              <span className="text-sm text-gray-600">{uploadProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 업로드 이력 */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">업로드 이력</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  업로드일시
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  파일명
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  프로젝트명
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  업로드자
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  크기
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상태
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  비고
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {uploadHistory.map((history) => (
                <tr key={history.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {history.uploadDate}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {history.fileName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {history.projectName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {history.uploader}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {history.size}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {history.status}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {history.note}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}