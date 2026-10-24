import { Link, Route, Routes } from 'react-router-dom';
export default function App() { return <><nav><Link to="/">OneLine</Link></nav><Routes><Route path="*" element={<main><h1>Your journey, connected.</h1><p>OneLine foundation is ready.</p></main>} /></Routes></>; }
