import React from 'react';
import { GrantApplicationForm } from './components/GrantApplicationForm';

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4 sm:px-6 lg:px-8 relative">
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=2900')] opacity-5"></div>
      <div className="relative max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            SCAGO Grant Application
          </h1>
          <p className="text-lg text-gray-600">
            Please fill out the form below to apply for a grant
          </p>
        </div>
        
        <GrantApplicationForm
          theme={{
            primary: 'gray',
            secondary: 'gray',
            accent: 'red'
          }}
          onSuccess={() => {
            console.log('Form submitted successfully');
          }}
        />
      </div>
    </div>
  );
}

export default App;