import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
	ArrowLeft,
	ArrowRight,
	CheckCircle2,
	FolderOpen,
	LayoutGrid,
	Lightbulb,
	Plus,
} from 'lucide-react';
import { api } from '../../api';
import PremiumHeader from '../common/PremiumHeader';
import '../home/Home.css';
import '../rooms/BrowseRooms.css';
import './CreateMapIntro.css';

const DEFAULT_TEMPLATES = [
	{
		id: 'classic-usa',
		name: 'Classic USA',
		description: 'Balanced gameplay with familiar city properties.',
		builtin: true,
	},
	{
		id: 'world-tour',
		name: 'World Tour',
		description: 'A global board filled with iconic destinations.',
		builtin: true,
	},
	{
		id: 'world-capitals',
		name: 'World Capitals',
		description: 'International landmarks and capital cities.',
		builtin: true,
	},
];

const BOARD_PALETTES = [
	['oklch(68% 0.18 29)', 'oklch(78% 0.14 86)', 'oklch(63% 0.14 240)', 'oklch(65% 0.15 145)'],
	['oklch(72% 0.15 75)', 'oklch(67% 0.16 42)', 'oklch(65% 0.11 210)', 'oklch(62% 0.14 280)'],
	['oklch(68% 0.18 340)', 'oklch(65% 0.16 295)', 'oklch(78% 0.14 95)', 'oklch(68% 0.16 145)'],
	['oklch(65% 0.09 75)', 'oklch(58% 0.08 55)', 'oklch(60% 0.07 225)', 'oklch(58% 0.06 280)'],
];

export default function CreateMapIntro({ pushToast }) {
	const nav = useNavigate();
	const [startMode, setStartMode] = useState('scratch');
	const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);
	const [selectedTemplateId, setSelectedTemplateId] = useState(DEFAULT_TEMPLATES[0].id);
	const [loadingTemplates, setLoadingTemplates] = useState(true);
	const [templateError, setTemplateError] = useState('');

	useEffect(() => {
		let isCurrent = true;
		api.listBoards()
			.then((response) => {
				if (!isCurrent) return;
				const discovered = response.builtin || [];
				const unique = [...new Map(discovered.map((board) => [board.id, board])).values()];
				if (unique.length) {
					setTemplates(unique);
					setSelectedTemplateId(unique[0].id);
				}
				setTemplateError('');
			})
			.catch(() => {
				if (isCurrent) setTemplateError('Using the built-in starter templates.');
			})
			.finally(() => {
				if (isCurrent) setLoadingTemplates(false);
			});
		return () => {
			isCurrent = false;
		};
	}, []);

	const visibleTemplates = useMemo(() => templates.slice(0, 4), [templates]);
	const selectedTemplate = templates.find((template) => template.id === selectedTemplateId);
	const placeholderCount = Math.max(0, 4 - visibleTemplates.length);

	function chooseMode(mode) {
		setStartMode(mode);
	}

	function chooseTemplate(templateId) {
		setSelectedTemplateId(templateId);
		setStartMode('template');
	}

	function createMap() {
		if (startMode === 'template' && !selectedTemplate) {
			pushToast('Choose a template to continue', 'error');
			return;
		}
		nav('/editor', {
			state: {
				mapStart:
					startMode === 'scratch'
						? { mode: 'scratch' }
						: { mode: 'template', templateId: selectedTemplate.id },
			},
		});
	}

	return (
		<main className="app-page landing-page create-map-page">
			<PremiumHeader pushToast={pushToast} showLogo onLogoClick={() => nav('/')} />

			<div className="create-map-shell">
				<button className="browse-back-button" type="button" onClick={() => nav('/')}>
					<ArrowLeft aria-hidden="true" /> Back
				</button>

				<header className="create-map-title">
					<h1>Create your own map</h1>
					<p>Design a custom board and bring your vision to life.</p>
				</header>

				<section className="create-map-section" aria-labelledby="map-start-title">
					<h2 id="map-start-title">Choose how to start</h2>
					<div
						className="create-map-mode-grid"
						role="radiogroup"
						aria-label="Starting point"
					>
						<StartOption
							icon={LayoutGrid}
							title="Start from scratch"
							description="Create a completely new board with a blank template."
							selected={startMode === 'scratch'}
							onClick={() => chooseMode('scratch')}
						/>
						<StartOption
							icon={FolderOpen}
							title="Use a template"
							description="Choose a template and customize it to match your ideas."
							selected={startMode === 'template'}
							onClick={() => chooseMode('template')}
						/>
					</div>
				</section>

				<section
					className="create-map-section map-template-section"
					aria-labelledby="map-template-title"
				>
					<div className="map-template-heading">
						<h2 id="map-template-title">Template preview</h2>
						<span aria-live="polite">
							{loadingTemplates ? 'Loading templates...' : templateError}
						</span>
					</div>
					<div className="map-template-grid" role="radiogroup" aria-label="Map template">
						{visibleTemplates.map((template, index) => (
							<TemplateCard
								key={template.id}
								template={template}
								palette={BOARD_PALETTES[index % BOARD_PALETTES.length]}
								selected={
									startMode === 'template' && selectedTemplateId === template.id
								}
								onClick={() => chooseTemplate(template.id)}
							/>
						))}
						{Array.from({ length: placeholderCount }, (_, index) => (
							<TemplatePlaceholder key={index} />
						))}
					</div>
				</section>

				<aside className="create-map-info">
					<span aria-hidden="true">
						<Lightbulb />
					</span>
					<div>
						<strong>You can edit every detail later</strong>
						<p>Add properties, set prices, place stations, and more in the editor.</p>
					</div>
				</aside>

				<div className="create-map-actions">
					<button
						type="button"
						onClick={createMap}
						disabled={loadingTemplates && startMode === 'template'}
					>
						<Plus aria-hidden="true" /> Create new map
					</button>
					<p>You’ll be taken to the map editor next.</p>
				</div>
			</div>
		</main>
	);
}

function StartOption({ icon: Icon, title, description, selected, onClick }) {
	return (
		<button
			className={`create-map-mode-card${selected ? ' is-selected' : ''}`}
			type="button"
			role="radio"
			aria-checked={selected}
			onClick={onClick}
		>
			<span className="create-map-mode-icon" aria-hidden="true">
				<Icon />
			</span>
			<span className="create-map-mode-copy">
				<strong>{title}</strong>
				<small>{description}</small>
			</span>
			{selected ? (
				<CheckCircle2 className="create-map-check" aria-hidden="true" />
			) : (
				<ArrowRight aria-hidden="true" />
			)}
		</button>
	);
}

function TemplateCard({ template, palette, selected, onClick }) {
	return (
		<button
			className={`map-template-card${selected ? ' is-selected' : ''}`}
			type="button"
			role="radio"
			aria-checked={selected}
			onClick={onClick}
		>
			<BoardMiniature palette={palette} />
			<strong>{template.name}</strong>
			<small>{template.description || 'A ready-made board you can customize.'}</small>
			{selected && <CheckCircle2 className="map-template-check" aria-hidden="true" />}
		</button>
	);
}

function TemplatePlaceholder() {
	return (
		<div className="map-template-card is-placeholder" aria-disabled="true">
			<BoardMiniature palette={BOARD_PALETTES[3]} muted />
			<strong>More templates</strong>
			<small>New starting boards will appear here.</small>
			<span>Coming soon</span>
		</div>
	);
}

function BoardMiniature({ palette, muted = false }) {
	return (
		<div className={`map-board-miniature${muted ? ' is-muted' : ''}`} aria-hidden="true">
			{Array.from({ length: 40 }, (_, position) => {
				const coordinates = tileCoordinates(position);
				const accent = palette[Math.floor(position / 10) % palette.length];
				return (
					<i
						key={position}
						style={{
							gridColumn: coordinates.column,
							gridRow: coordinates.row,
							'--map-tile-accent': accent,
						}}
					/>
				);
			})}
			<img src="/brand-mark.png" alt="" />
		</div>
	);
}

function tileCoordinates(position) {
	if (position <= 10) return { column: 11 - position, row: 11 };
	if (position <= 20) return { column: 1, row: 21 - position };
	if (position <= 30) return { column: position - 19, row: 1 };
	return { column: 11, row: position - 29 };
}
