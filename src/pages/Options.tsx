// Redirect to dashboard — options are now shown inside AccountView tabs
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Options() {
  const navigate = useNavigate();
  useEffect(() => { navigate('/'); }, []);
  return null;
}
