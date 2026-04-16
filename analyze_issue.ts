import { GoogleGenAI, Type } from "@google/genai";

async function analyze() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const prompt = `
    Analyze the following code and Firestore rules for a document upload feature that is failing.
    The user says "carica documento non funziona non riesce a salvare".
    
    App.tsx handleAddDocument:
    \`\`\`typescript
    const handleAddDocument = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newDocumentTitle || !newDocumentFile) return;
      setIsUploading(true);
      setError(null);
      setUploadProgress({});
      
      try {
        validateFile(newDocumentFile);
        const sanitizedName = newDocumentFile.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const storageRef = ref(storage, \`projects/\${project.id}/documents/\${Date.now()}_\${sanitizedName}\`);
        
        const url = await uploadFileWithProgress(storageRef, newDocumentFile, (p) => setUploadProgress(prev => ({ ...prev, doc: p })));

        const professional = members.find(m => m.id === newDocumentProfessionalId);

        const docData = {
          projectId: project.id,
          title: newDocumentTitle,
          type: newDocumentType,
          url,
          professionalId: newDocumentProfessionalId || null,
          professionalEmail: professional?.userEmail || null,
          uploadedBy: user?.email || 'unknown',
          createdAt: serverTimestamp(),
        };

        try {
          await addDoc(collection(db, 'projects', project.id, 'documents'), docData);
        } catch (fsErr) {
          handleFirestoreError(fsErr, OperationType.CREATE, \`projects/\${project.id}/documents\`);
        }
        
        setIsAddingDocument(false);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsUploading(false);
      }
    };
    \`\`\`

    Firestore Rules:
    \`\`\`javascript
    function isProjectEditor(projectId, projectData) {
      return isAuthenticated() && (
        projectData.ownerId == request.auth.uid ||
        (projectData.memberIds is list && request.auth.uid in projectData.memberIds)
      );
    }

    function isValidDocument(data) {
      return data.keys().hasAll(['projectId', 'title', 'type', 'url', 'uploadedBy', 'createdAt']) &&
             data.projectId is string &&
             data.title is string && data.title.size() > 0 &&
             data.type in ['business_plan', 'tax_planning', 'contract', 'permit', 'quote', 'photo', 'other'] &&
             data.url is string &&
             data.uploadedBy is string &&
             data.createdAt is timestamp &&
             (!('professionalId' in data) || data.professionalId is string || data.professionalId == null) &&
             (!('professionalEmail' in data) || data.professionalEmail is string || data.professionalEmail == null);
    }

    match /projects/{projectId}/documents/{docId} {
      allow create: if (isProjectEditor(projectId, get(/databases/$(database)/documents/projects/$(projectId)).data) || isAdmin()) && isValidDocument(request.resource.data);
    }
    \`\`\`

    Identify potential issues and suggest fixes.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: prompt,
  });

  console.log(response.text);
}

analyze();
