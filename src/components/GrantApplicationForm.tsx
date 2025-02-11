import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { z } from 'zod';
import * as Icons from 'lucide-react';
const { Loader2: Loader2Icon, CheckCircle: CheckCircleIcon, AlertCircle: AlertCircleIcon } = Icons;
import { supabase } from '../lib/supabase';

// Canadian postal code regex
const postalCodeRegex = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/;
// Phone number regex (XXX-XXX-XXXX or (XXX) XXX-XXXX)
const phoneRegex = /^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/;

const provinces = [
  
  'Ontario',
  'Quebec',
  'Nova Scotia',
  'New Brunswick',
  'Manitoba',
  'British Columbia',
  'Prince Edward Island',
  'Saskatchewan',
  'Alberta',
  'Newfoundland and Labrador',
];

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const ACCEPTED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

const formSchema = z.object({
  isForChild: z.string().min(1, 'Please select if this is for a child'),
  applicantName: z.string().min(2, 'Name must be at least 2 characters'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  street: z.string().min(5, 'Please enter a valid street address'),
  city: z.string().min(2, 'Please enter a valid city'),
  province: z.string().refine((val) => provinces.includes(val), 'Please select a valid province'),
  postalCode: z.string().regex(postalCodeRegex, 'Please enter a valid postal code'),
  email: z.string().email('Please enter a valid email'),
  phoneNumber: z.string().regex(phoneRegex, 'Please enter a valid phone number (e.g., XXX-XXX-XXXX)'),
  dateGrantRequested: z.string().min(1, 'Date is required'),
  fundsUsage: z.string().min(10, 'Please provide more details'),
  previousGrant: z.boolean(),
  previousGrantUsage: z.string().optional().or(z.string().min(1, 'Please explain previous grant usage')),
  supportLetter: z
    .any()
    .refine((files) => files && files[0], "Support letter is required")
    .refine((files) => {
      if (!files || !files[0]) return false;
      const file = files[0];
      return file instanceof File;
    }, "Invalid file")
    .refine((files) => {
      if (!files || !files[0]) return false;
      const file = files[0];
      return file.size <= MAX_FILE_SIZE;
    }, "File size must be less than 25MB")
    .refine((files) => {
      if (!files || !files[0]) return false;
      const file = files[0];
      return ACCEPTED_FILE_TYPES.includes(file.type);
    }, "Only .pdf, .jpg, and .png files are accepted"),
  verifyInformation: z.boolean().refine((val) => val === true, {
    message: 'You must verify the information',
  }),
});

type FormData = z.infer<typeof formSchema>;

// Add this type for the error message
type ErrorMessage = string | React.ReactNode;

interface Props {
  onSuccess?: () => void;
  theme?: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

export const GrantApplicationForm: React.FC<Props> = ({
  onSuccess,
  theme = {
    primary: 'blue',
    secondary: 'gray',
    accent: 'indigo',
  },
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  const previousGrant = watch('previousGrant');

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      let supportLetterUrl = '';
      
      // Handle file upload to Supabase Storage
      if (data.supportLetter && data.supportLetter[0]) {
        const file = data.supportLetter[0];
        const fileExt = file.name.split('.').pop()?.toLowerCase();
        
        // Create filename using applicant name
        const sanitizedName = data.applicantName
          .trim()
          .replace(/[^a-zA-Z0-9\s]/g, '')
          .replace(/\s+/g, '-');
        
        const fileName = `${sanitizedName}-Support-Letter.${fileExt}`;

        try {
          // Upload new file
          const { data: uploadData, error: uploadError } = await supabase
            .storage
            .from('support-letters')
            .upload(fileName, file, {
              cacheControl: '3600',
              upsert: true
            });

          if (uploadError) {
            console.error('Upload error details:', uploadError);
            throw uploadError;
          }

          // Get the public URL using Supabase's getPublicUrl method
          const { data: { publicUrl } } = supabase
            .storage
            .from('support-letters')
            .getPublicUrl(fileName);

          supportLetterUrl = publicUrl;

          // Verify the file exists
          const { data: checkData, error: checkError } = await supabase
            .storage
            .from('support-letters')
            .list('', {
              search: fileName
            });

          if (checkError || !checkData?.length) {
            throw new Error('File upload verification failed');
          }

        } catch (error) {
          console.error('Storage error:', error);
          throw new Error('Failed to upload support letter. Please try again.');
        }
      }

      // Prepare payload with all data including file URL
      const formPayload = {
        is_for_child: data.isForChild === 'yes',
        applicant_name: data.applicantName,
        date_of_birth: data.dateOfBirth,
        mailing_address: `${data.street}, ${data.city}, ${data.province} ${data.postalCode}`,
        email: data.email,
        phone_number: data.phoneNumber,
        date_requested: data.dateGrantRequested,
        funds_usage: data.fundsUsage,
        previous_grant: Boolean(data.previousGrant),
        previous_grant_usage: data.previousGrantUsage,
        verify_information: Boolean(data.verifyInformation),
        support_letter: {
          file_name: data.supportLetter?.[0]?.name || '',
          file_url: supportLetterUrl
        }
      };

      try {
        // Send to Make webhook
        const makeResponse = await fetch('https://hook.us2.make.com/tfps36ob9e2dwbxul7ol4ilqr4am67yl', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formPayload),
        });
        
        if (!makeResponse.ok) {
          console.warn('Make webhook warning:', await makeResponse.text());
        }
      } catch (makeError) {
        console.error('Make webhook error:', makeError);
      }

      try {
        // Send to Retool webhook
        const retoolResponse = await fetch('https://api.retool.com/v1/workflows/97f6fb26-de8a-4cd1-bcf6-86fc922bd846/startTrigger', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': '*/*',
          },
          body: JSON.stringify(formPayload),
        });
        
        if (!retoolResponse.ok) {
          console.warn('Retool webhook warning:', await retoolResponse.text());
        }
      } catch (retoolError) {
        console.error('Retool webhook error:', retoolError);
      }

      // Insert into Supabase database
      const { error: insertError } = await supabase.from('grant_applications').insert([
        {
          is_for_child: data.isForChild === 'yes',
          applicant_name: data.applicantName,
          date_of_birth: data.dateOfBirth,
          mailing_address: `${data.street}, ${data.city}, ${data.province} ${data.postalCode}`,
          email: data.email,
          phone_number: data.phoneNumber,
          date_requested: data.dateGrantRequested,
          funds_usage: data.fundsUsage,
          previous_grant: Boolean(data.previousGrant),
          previous_grant_usage: data.previousGrantUsage,
          verify_information: Boolean(data.verifyInformation),
          support_letter_url: supportLetterUrl
        },
      ]);

      if (insertError) throw insertError;

      setSubmitSuccess(true);
      onSuccess?.();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClasses = `mt-1 block w-full rounded-xl border-0 bg-white/5 backdrop-blur-md 
    shadow-sm ring-1 ring-inset ring-white/20 focus:ring-2 focus:ring-inset focus:ring-[#C8262A] 
    text-gray-900 placeholder:text-gray-500 px-4 py-3 transition-all duration-200`;

  const labelClasses = "block text-sm font-medium text-gray-700 mb-1";

  const resetForm = () => {
    setSubmitSuccess(false);
    reset();
    setSubmitError(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ 
        opacity: 1, 
        y: 0,
        height: submitSuccess ? 'auto' : '100%',
        scale: submitSuccess ? 0.95 : 1
      }}
      className="max-w-2xl mx-auto p-8 bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl 
        border border-white/20 relative overflow-hidden"
    >
      {submitSuccess ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-8"
        >
          <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Application Submitted Successfully!</h3>
          <p className="text-gray-600 mb-6">Please be patient as we review your application. We will contact you soon.</p>
          <button
            onClick={resetForm}
            className="px-6 py-2 bg-[#C8262A] text-white rounded-lg hover:bg-[#A01E21] transition-colors duration-200 w-[40%] mx-auto"
          >
            Submit New Application
          </button>
        </motion.div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <h2 className="text-2xl font-bold mb-6 text-gray-900">
            Respite Grant Application Form
          </h2>

          <div className="mb-4">
            <label className={labelClasses}>
              Is this application for a child?
            </label>
            <div className="flex space-x-4 mt-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="yes"
                  {...register('isForChild')}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Yes</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="no"
                  defaultChecked
                  {...register('isForChild')}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">No</span>
              </label>
            </div>
            {errors.isForChild && (
              <p className="mt-1 text-sm text-red-600">{errors.isForChild.message}</p>
            )}
          </div>

          <div>
            <label className={labelClasses}>
              Applicant Name
            </label>
            <input
              {...register('applicantName')}
              className={inputClasses}
              placeholder="Enter your full name"
            />
            {errors.applicantName && (
              <p className="mt-1 text-sm text-red-600">{errors.applicantName.message}</p>
            )}
          </div>

          <div>
            <label className={labelClasses}>
              Date of Birth
            </label>
            <input
              type="date"
              {...register('dateOfBirth')}
              className={`${inputClasses} cursor-pointer [&::-webkit-calendar-picker-indicator]:text-[#C8262A] [&::-webkit-calendar-picker-indicator]:hover:cursor-pointer [&::-webkit-calendar-picker-indicator]:filter-[#C8262A]`}
              onClick={(e) => e.currentTarget.showPicker()}
            />
            {errors.dateOfBirth && (
              <p className="mt-1 text-sm text-red-600">{errors.dateOfBirth.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClasses}>
                Street Address
              </label>
              <input
                {...register('street')}
                className={inputClasses}
                placeholder="123 Main St"
              />
              {errors.street && (
                <p className="mt-1 text-sm text-red-600">{errors.street.message}</p>
              )}
            </div>

            <div>
              <label className={labelClasses}>
                City
              </label>
              <input
                {...register('city')}
                className={inputClasses}
                placeholder="Toronto"
              />
              {errors.city && (
                <p className="mt-1 text-sm text-red-600">{errors.city.message}</p>
              )}
            </div>

            <div>
              <label className={labelClasses}>
                Province
              </label>
              <select
                {...register('province')}
                className={inputClasses}
                defaultValue=""
              >
                <option value="" disabled>Select a province</option>
                {provinces.map((province) => (
                  <option key={province} value={province}>
                    {province}
                  </option>
                ))}
              </select>
              {errors.province && (
                <p className="mt-1 text-sm text-red-600">{errors.province.message}</p>
              )}
            </div>

            <div>
              <label className={labelClasses}>
                Postal Code
              </label>
              <input
                {...register('postalCode')}
                className={inputClasses}
                placeholder="A1A 1A1"
              />
              {errors.postalCode && (
                <p className="mt-1 text-sm text-red-600">{errors.postalCode.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className={labelClasses}>
              E-transfer Email
            </label>
            <input
              type="email"
              {...register('email')}
              className={inputClasses}
              placeholder="your.email@example.com"
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className={labelClasses}>
              Phone Number
            </label>
            <input
              type="tel"
              {...register('phoneNumber')}
              className={inputClasses}
              placeholder="XXX-XXX-XXXX"
            />
            {errors.phoneNumber && (
              <p className="mt-1 text-sm text-red-600">{errors.phoneNumber.message}</p>
            )}
          </div>

          <div>
            <label className={labelClasses}>
              Date Grant Requested
            </label>
            <input
              type="date"
              {...register('dateGrantRequested')}
              className={`${inputClasses} cursor-pointer [&::-webkit-calendar-picker-indicator]:text-[#C8262A] [&::-webkit-calendar-picker-indicator]:hover:cursor-pointer [&::-webkit-calendar-picker-indicator]:filter-[#C8262A]`}
              onClick={(e) => e.currentTarget.showPicker()}
            />
            {errors.dateGrantRequested && (
              <p className="mt-1 text-sm text-red-600">{errors.dateGrantRequested.message}</p>
            )}
          </div>

          <div>
            <label className={labelClasses}>
              If approved, how will the funds be used?
            </label>
            <textarea
              {...register('fundsUsage')}
              className={`${inputClasses} min-h-[120px]`}
              placeholder="Please provide detailed information about how you plan to use the funds..."
            />
            {errors.fundsUsage && (
              <p className="mt-1 text-sm text-red-600">{errors.fundsUsage.message}</p>
            )}
          </div>

          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                {...register('previousGrant')}
                className="rounded border-gray-300 text-[#C8262A] focus:ring-[#C8262A]"
              />
              <span className="text-sm font-medium text-gray-700">
                Have you received grants from SCAGO before?
              </span>
            </label>
          </div>

          {previousGrant && (
            <div>
              <label className={labelClasses}>
                Please explain when and how the funds were used
              </label>
              <textarea
                {...register('previousGrantUsage')}
                className={`${inputClasses} min-h-[100px]`}
                placeholder="Provide details about your previous grant usage..."
              />
              {errors.previousGrantUsage && (
                <p className="mt-1 text-sm text-red-600">{errors.previousGrantUsage.message}</p>
              )}
            </div>
          )}

          <div>
            <label className={labelClasses}>
              Support letter from social/caseworker
            </label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              {...register('supportLetter')}
              className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 
                file:rounded-full file:border-0 file:text-sm file:font-semibold
                file:bg-[#C8262A] file:text-white hover:file:bg-[#A01E21]
                transition-all duration-200"
            />
            {errors.supportLetter && (
              <p className="mt-1 text-sm text-red-600">
                {(errors.supportLetter.message as ErrorMessage) || 'Invalid file'}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Accepted file types: PDF, JPG, PNG (max 25MB)
            </p>
          </div>

          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                {...register('verifyInformation')}
                className="rounded border-gray-300 text-[#C8262A] focus:ring-[#C8262A]"
              />
              <span className="text-sm font-medium text-gray-700">
                I hereby verify that all information provided on this form is true
              </span>
            </label>
            {errors.verifyInformation && (
              <p className="mt-1 text-sm text-red-600">{errors.verifyInformation.message}</p>
            )}
          </div>

          {submitError && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-4 rounded-lg bg-red-50 text-red-700 flex items-center space-x-2"
            >
              <AlertCircleIcon className="w-5 h-5" />
              <span>{submitError}</span>
            </motion.div>
          )}

          <motion.button
            type="submit"
            disabled={isSubmitting}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg
              text-sm font-medium text-white bg-[#C8262A] hover:bg-[#A01E21]
              focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#C8262A]
              disabled:opacity-50 transition-all duration-200 shadow-lg
              backdrop-blur-sm"
          >
            {isSubmitting ? (
              <Loader2Icon className="w-5 h-5 animate-spin" />
            ) : (
              'Submit Application'
            )}
          </motion.button>
        </form>
      )}
    </motion.div>
  );
};