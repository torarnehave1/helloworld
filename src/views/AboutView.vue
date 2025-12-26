<script setup>
</script>

<template>
  <div class="about-view">
    <div class="about-card main-card">
      <h1>Hello Vegvisr</h1>
      <p class="intro">
        Hello Vegvisr is a minimal doorway for you to share living knowledge with a wider peer community.
        It lets you contribute short notes in <strong>markdown</strong> that are then seen and reviewed by
        fellow practitioners before they join the wider Vegvisr field.
      </p>
      <blockquote class="quote">
        "Kunnskap blir levende først når den får danse i erfaring."
        <span class="translation">– knowledge becomes alive when it can dance in experience.</span>
        <a href="https://www.perplexity.ai/search/1bfaa80f-c3f2-4d3d-8f93-050d8ae3acfa" target="_blank" rel="noopener" class="ref">[1]</a>
        <a href="https://khoros.com/blog/how-to-choose-online-community-platform" target="_blank" rel="noopener" class="ref">[2]</a>
      </blockquote>
    </div>

    <div class="about-card">
      <h2>Who Hello Vegvisr is for</h2>
      <p>Hello Vegvisr is created for:</p>
      <ul class="audience-list">
        <li>People in language studies, etymology, and cross-cultural research</li>
        <li>Practitioners of Norse, Chinese, Vedic, Hindu, Sanskrit and other ancestral traditions</li>
        <li>Somatic movement, dance, and embodiment practitioners; bodyworkers and yoga teachers</li>
        <li>Sound healers and sound technologists working with mantras, slokas, seed sounds, and primordial vibration</li>
        <li>Creators, influencers, and storytellers who weave myth, motivation, and inner work into their offerings</li>
      </ul>
      <blockquote class="quote">
        "Listen so deeply that bones, breath, and syllables speak with the same ancient voice."
        <span class="translation">– in the spirit of sound and body mystics.</span>
        <a href="https://www.perplexity.ai/search/36c79a34-f8a6-4650-b900-2ecf5b193155" target="_blank" rel="noopener" class="ref">[3]</a>
        <a href="https://displaypurposes.com/hashtags/hashtag/soundhealing" target="_blank" rel="noopener" class="ref">[4]</a>
      </blockquote>
    </div>

    <div class="about-card references-card">
      <h3>References</h3>
      <ol class="references">
        <li><a href="https://www.perplexity.ai/search/1bfaa80f-c3f2-4d3d-8f93-050d8ae3acfa" target="_blank" rel="noopener">Perplexity - Living Knowledge</a></li>
        <li><a href="https://khoros.com/blog/how-to-choose-online-community-platform" target="_blank" rel="noopener">Khoros - Community Platforms</a></li>
        <li><a href="https://www.perplexity.ai/search/36c79a34-f8a6-4650-b900-2ecf5b193155" target="_blank" rel="noopener">Perplexity - Sound and Body</a></li>
        <li><a href="https://displaypurposes.com/hashtags/hashtag/soundhealing" target="_blank" rel="noopener">Display Purposes - Sound Healing</a></li>
        <li><a href="https://hello.vegvisr.org/" target="_blank" rel="noopener">Hello Vegvisr</a></li>
      </ol>
    </div>
  </div>
</template>

<style scoped>
.about-view {
  max-width: 700px;
  margin: 0 auto;
}

.about-card {
  background: white;
  border-radius: 12px;
  padding: 28px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.main-card {
  background: linear-gradient(135deg, #4f6d7a 0%, #5a7d8a 100%);
  color: white;
}

.main-card h1 {
  font-size: 2rem;
  margin-bottom: 16px;
}

.intro {
  font-size: 1.1rem;
  line-height: 1.7;
  opacity: 0.95;
}

.intro strong {
  font-weight: 600;
}

h2 {
  color: #333;
  font-size: 1.4rem;
  margin-bottom: 16px;
}

h3 {
  color: #333;
  font-size: 1.1rem;
  margin-bottom: 12px;
}

p {
  color: #555;
  line-height: 1.6;
  margin-bottom: 16px;
}

.audience-list {
  list-style: none;
  padding: 0;
  margin: 0 0 20px 0;
}

.audience-list li {
  position: relative;
  padding-left: 24px;
  margin-bottom: 12px;
  color: #444;
  line-height: 1.5;
}

.audience-list li::before {
  content: "";
  position: absolute;
  left: 0;
  top: 8px;
  width: 8px;
  height: 8px;
  background: #4f6d7a;
  border-radius: 50%;
}

.quote {
  margin: 24px 0 0 0;
  padding: 20px 24px;
  border-left: 4px solid rgba(255, 255, 255, 0.4);
  font-style: italic;
  font-size: 1.05rem;
  line-height: 1.6;
}

.main-card .quote {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 0 8px 8px 0;
}

.about-card:not(.main-card) .quote {
  background: #f8f9fa;
  border-left-color: #4f6d7a;
  color: #555;
}

.translation {
  display: block;
  margin-top: 8px;
  font-style: normal;
  opacity: 0.85;
  font-size: 0.95rem;
}

.ref {
  font-size: 0.8rem;
  opacity: 0.7;
  text-decoration: none;
  margin-left: 4px;
}

.main-card .ref {
  color: white;
}

.about-card:not(.main-card) .ref {
  color: #4f6d7a;
}

.ref:hover {
  opacity: 1;
  text-decoration: underline;
}

.references-card {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
}

.references {
  margin: 0;
  padding-left: 20px;
}

.references li {
  margin-bottom: 8px;
  color: #666;
  font-size: 0.9rem;
}

.references a {
  color: #4f6d7a;
  text-decoration: none;
}

.references a:hover {
  text-decoration: underline;
}
</style>
